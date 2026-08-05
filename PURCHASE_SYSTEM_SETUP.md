# Purchase System — Database Setup Guide

This document tracks the Supabase schema for the Purchase system (`src/systems/purchase/`), phase by phase. There is no migrations CLI wired up in this repo — run each SQL block below manually in the **Supabase SQL Editor** (same process as `WHATSAPP_SETUP.md` / `FESTIVAL_SCHEDULER_SETUP.md`). All tables are prefixed `purchase_` to keep them namespaced from the other systems.

Uses the **master** Supabase project (`src/SupabaseClient.js`), same as the Checklist & Delegation system — the Purchase system has no Supabase instance of its own.

---

## Phase 1 — Indent (`IndentPage.jsx` / `ImportView.jsx`)

Backs the current in-memory Redux slice (`src/systems/purchase/redux/purchaseSlice.js`): rows imported from Excel get a generated Unique No. (`IND/YYYY/NNNN`), then move through Pending → Approved/Rejected in the Approval phase. Each re-decision is archived to a history table instead of being overwritten.

```sql
-- ════════════════════════════════════════════════════════════════════════
-- 1. purchase_counters — atomic sequence source for generated document numbers
--    (indent numbers now, PO numbers later phases)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.purchase_counters (
  counter_key text NOT NULL,
  next_value integer NOT NULL DEFAULT 1,
  CONSTRAINT purchase_counters_pkey PRIMARY KEY (counter_key)
);

ALTER TABLE public.purchase_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for authenticated users" ON public.purchase_counters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated users" ON public.purchase_counters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON public.purchase_counters FOR UPDATE TO authenticated USING (true);

-- Atomically reserves and returns the next indent number for the given year,
-- e.g. purchase_next_indent_no(2026) -> 'IND/2026/0001'
CREATE OR REPLACE FUNCTION public.purchase_next_indent_no(p_year integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_key text := 'indent_' || p_year;
  v_next integer;
BEGIN
  INSERT INTO public.purchase_counters (counter_key, next_value)
  VALUES (v_key, 2)
  ON CONFLICT (counter_key)
  DO UPDATE SET next_value = public.purchase_counters.next_value + 1
  RETURNING next_value - 1 INTO v_next;

  RETURN 'IND/' || p_year || '/' || LPAD(v_next::text, 4, '0');
END;
$$;

-- Atomically reserves p_count sequential indent numbers in one round trip
-- (used by the Excel import, which inserts many rows at once), e.g.
-- purchase_reserve_indent_numbers(2026, 3) -> IND/2026/0001, IND/2026/0002, IND/2026/0003
CREATE OR REPLACE FUNCTION public.purchase_reserve_indent_numbers(p_year integer, p_count integer)
RETURNS TABLE(unique_no text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_key text := 'indent_' || p_year;
  v_start integer;
BEGIN
  INSERT INTO public.purchase_counters (counter_key, next_value)
  VALUES (v_key, p_count + 1)
  ON CONFLICT (counter_key)
  DO UPDATE SET next_value = public.purchase_counters.next_value + p_count
  RETURNING next_value - p_count INTO v_start;

  RETURN QUERY
  SELECT 'IND/' || p_year || '/' || LPAD(gs::text, 4, '0')
  FROM generate_series(v_start, v_start + p_count - 1) AS gs;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. purchase_indents — one row per imported line item (the "Indent Data" grid)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.purchase_indents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  unique_no text NOT NULL,                       -- e.g. IND/2026/0001, from purchase_next_indent_no()
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.users(id),   -- who ran the import
  import_batch_id uuid,                          -- groups rows from the same Excel import

  -- Imported fields (from Excel, see ImportView.jsx)
  item_details text NOT NULL,
  category text NOT NULL DEFAULT 'Uncategorized',
  vendor text,
  unit text DEFAULT 'Pcs.',
  alt_unit text,
  parent_group text,
  shelf_capacity text,
  max_level_qty numeric DEFAULT 0,
  rol_qty numeric DEFAULT 0,                     -- reorder level qty
  cl_qty numeric DEFAULT 0,                       -- closing qty
  conversion_unit text,
  order_formula numeric DEFAULT 0,                -- suggested order qty

  -- Approval-phase fields (set later, kept here so Indent Data reflects current state)
  status text NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  remarks text,
  approved_qty numeric,
  decided_at timestamp with time zone,

  -- PO-phase link (nullable; no FK yet — purchase_orders table doesn't exist until that phase)
  po_no text,
  po_id uuid,

  CONSTRAINT purchase_indents_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_indents_unique_no_key UNIQUE (unique_no)
);

CREATE INDEX IF NOT EXISTS idx_purchase_indents_status ON public.purchase_indents (status);
CREATE INDEX IF NOT EXISTS idx_purchase_indents_category ON public.purchase_indents (category);
CREATE INDEX IF NOT EXISTS idx_purchase_indents_vendor ON public.purchase_indents (vendor);
CREATE INDEX IF NOT EXISTS idx_purchase_indents_import_batch ON public.purchase_indents (import_batch_id);

ALTER TABLE public.purchase_indents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for authenticated users" ON public.purchase_indents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated users" ON public.purchase_indents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON public.purchase_indents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete for authenticated users" ON public.purchase_indents FOR DELETE TO authenticated USING (true);

-- ════════════════════════════════════════════════════════════════════════
-- 3. purchase_indent_history — archived decision trail
--    (every time a Pending/decided item is re-decided, its previous
--    status/remarks/approved_qty/decided_at is archived here before overwrite)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.purchase_indent_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  indent_id uuid NOT NULL REFERENCES public.purchase_indents(id) ON DELETE CASCADE,
  status text NOT NULL,
  remarks text,
  approved_qty numeric,
  decided_at timestamp with time zone,
  archived_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_indent_history_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_indent_history_indent_id ON public.purchase_indent_history (indent_id);

ALTER TABLE public.purchase_indent_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for authenticated users" ON public.purchase_indent_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated users" ON public.purchase_indent_history FOR INSERT TO authenticated WITH CHECK (true);
```

### Notes / mapping back to the current Redux model

| Redux field (`purchaseSlice.js`) | Column | Notes |
|---|---|---|
| `id` ("IND/2026/0001") | `unique_no` | Generated via `purchase_next_indent_no(year)`; `id` is now a separate `uuid` surrogate key |
| `itemDetails` | `item_details` | |
| `category`, `vendor`, `unit`, `altUnit`, `parentGroup`, `shelfCapacity`, `conversionUnit` | same, snake_case | |
| `maxLevelQty`, `rolQty`, `clQty`, `orderFormula` | same, snake_case, `numeric` | |
| `status`, `remarks`, `approvedQty`, `decidedAt` | same, snake_case | |
| `history[]` | `purchase_indent_history` rows | One row appended per re-decision instead of a JSON array column |
| `poNo`, `poId` | `po_no`, `po_id` | `po_id` will get an FK once the PO tables (later phase) exist |

Not modeled yet (next phases): `purchase_orders`, `purchase_po_items`, `purchase_po_revisions` for the PO Create/List/Pending views.

---

## Phase 2 — Approval (`ApprovalPage.jsx` / `ApprovalView.jsx`)

Reuses `purchase_indents` and `purchase_indent_history` from Phase 1 — no new tables. Adds one RPC that performs the "decide a whole category at once" action atomically: for every selected item, archive its current decision (if it already had one) into `purchase_indent_history`, then overwrite `status` / `remarks` / `approved_qty` / `decided_at` on `purchase_indents`.

```sql
-- ════════════════════════════════════════════════════════════════════════
-- 4. purchase_decide_category — approve/reject a batch of indent items,
--    archiving each item's previous decision (if any) before overwriting it.
--    Called from ApprovalView.jsx's "Save Decision" button.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.purchase_decide_category(
  p_ids uuid[],       -- purchase_indents.id values for the checked items
  p_qty jsonb,         -- { "<indent uuid>": qty, ... } — omit a key to keep order_formula
  p_status text,       -- 'Approved' | 'Rejected'
  p_remarks text
)
RETURNS SETOF public.purchase_indents
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_qty numeric;
BEGIN
  IF p_status NOT IN ('Approved', 'Rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    INSERT INTO public.purchase_indent_history (indent_id, status, remarks, approved_qty, decided_at)
    SELECT id, status, remarks, approved_qty, decided_at
    FROM public.purchase_indents
    WHERE id = v_id AND status <> 'Pending';

    v_qty := (p_qty ->> v_id::text)::numeric;

    UPDATE public.purchase_indents
    SET status = p_status,
        remarks = p_remarks,
        approved_qty = COALESCE(v_qty, order_formula),
        decided_at = now(),
        updated_at = now()
    WHERE id = v_id;
  END LOOP;

  RETURN QUERY SELECT * FROM public.purchase_indents WHERE id = ANY(p_ids);
END;
$$;
```

### Notes / mapping back to the current Redux model

| Redux reducer (`decideCategory`) | DB equivalent |
|---|---|
| `ids` (array of `IND/...` unique_no) | `p_ids` — now `purchase_indents.id` (uuid), since that's the stable key once decisions live in the DB |
| `qtyById` | `p_qty` (jsonb map, keyed by the same uuid) |
| `item.history.push(...)` before overwrite | RPC inserts into `purchase_indent_history` when the item's current `status <> 'Pending'` |
| `item.status/remarks/approvedQty/decidedAt = ...` | RPC `UPDATE ... purchase_indents` |

`ApprovalView.jsx` fetches all rows via the existing `fetchIndents()` (same as Indent Data), splits Pending vs. decided client-side, and the Timeline modal fetches that item's rows from `purchase_indent_history` on demand instead of reading an in-memory `history[]` array.

No migrations were run — copy the SQL blocks above into the Supabase SQL Editor when ready.

---

## Phase 3 — PO Create / PO List (`PoCreatePage.jsx`, `PoListPage.jsx`)

Two new tables plus one item table — kept deliberately flat (no revision-item normalization): a full JSON snapshot of the previous version is archived to `purchase_po_revisions` on every revise, instead of a parallel `purchase_po_revision_items` table.

```sql
-- ════════════════════════════════════════════════════════════════════════
-- 5. purchase_next_po_no — same reservation pattern as purchase_next_indent_no,
--    keyed by financial year, formatted like BE/PO/2026-27/001
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.purchase_next_po_no(p_year integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_key text := 'po_' || p_year;
  v_next integer;
BEGIN
  INSERT INTO public.purchase_counters (counter_key, next_value)
  VALUES (v_key, 2)
  ON CONFLICT (counter_key)
  DO UPDATE SET next_value = public.purchase_counters.next_value + 1
  RETURNING next_value - 1 INTO v_next;

  RETURN 'BE/PO/' || p_year || '-' || (p_year + 1 - 2000) || '/' || LPAD(v_next::text, 3, '0');
END;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. purchase_pos — one row per PO (revising a PO updates this row in place;
--    the pre-revision state is archived to purchase_po_revisions below)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.purchase_pos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  po_no text NOT NULL,                            -- current number, e.g. BE/PO/2026-27/001 or ...-R1 after a revision
  base_no text NOT NULL,                          -- original number, never changes
  revision integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.users(id),

  po_date date,
  requisitioner text,
  ship_via text,
  fob text,
  ship_terms text,

  vendor_name text NOT NULL,
  vendor_addr text,
  vendor_gstin text,
  vendor_contact text,
  vendor_email text,

  ship_gstin text,
  ship_contact text,
  ship_email text,

  terms text,
  discount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  grand_total numeric DEFAULT 0,

  CONSTRAINT purchase_pos_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_pos_vendor ON public.purchase_pos (vendor_name);

ALTER TABLE public.purchase_pos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for authenticated users" ON public.purchase_pos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated users" ON public.purchase_pos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON public.purchase_pos FOR UPDATE TO authenticated USING (true);

-- ════════════════════════════════════════════════════════════════════════
-- 7. purchase_po_items — current line items for a PO (deleted + re-inserted
--    on every revise, since there's always exactly one live item set per PO)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.purchase_po_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_pos(id) ON DELETE CASCADE,
  indent_id uuid REFERENCES public.purchase_indents(id), -- null for "extra material" lines
  product_code text,
  product_name text,
  hsn text,
  qty numeric DEFAULT 0,
  units text,
  rate numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  amount numeric DEFAULT 0,
  is_extra boolean DEFAULT false,
  CONSTRAINT purchase_po_items_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_po_items_po_id ON public.purchase_po_items (po_id);

ALTER TABLE public.purchase_po_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for authenticated users" ON public.purchase_po_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated users" ON public.purchase_po_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON public.purchase_po_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete for authenticated users" ON public.purchase_po_items FOR DELETE TO authenticated USING (true);

-- ════════════════════════════════════════════════════════════════════════
-- 8. purchase_po_revisions — one JSON snapshot per prior version, taken right
--    before purchase_pos is overwritten by a revise
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.purchase_po_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_pos(id) ON DELETE CASCADE,
  po_no text,
  snapshot jsonb NOT NULL,   -- { poNo, poDate, vendor, shipTo, requisitioner, shipVia, fob, shipTerms, items[], terms, total, discount, grandTotal }
  revised_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_po_revisions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_po_revisions_po_id ON public.purchase_po_revisions (po_id);

ALTER TABLE public.purchase_po_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for authenticated users" ON public.purchase_po_revisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated users" ON public.purchase_po_revisions FOR INSERT TO authenticated WITH CHECK (true);
```

### Notes / mapping back to the current Redux model

| Redux (`submitNewPO` / `revisePO`) | DB equivalent |
|---|---|
| `state.poCounter`, `'PO-' + counter` (in-memory id) | `purchase_pos.id` (uuid), number itself from `purchase_next_po_no(year)` |
| `items[].indentId` (was indent's `IND/...` unique_no) | `purchase_po_items.indent_id` — now the indent's uuid (`purchase_indents.id`), so it can be a real FK |
| `newPO.previousVersions.push(snapshot)` | one row in `purchase_po_revisions`, fetched on demand instead of embedded |
| `rec.poNo = newPO.poNo; rec.poId = newPO.id` on affected indents | `UPDATE purchase_indents SET po_no, po_id WHERE id = ANY(indent_ids)` after the PO insert |

Writes are done as a few sequential Supabase calls from `purchaseService.js` (reserve number → insert PO → insert items → update indents), not a single DB transaction — acceptable for this internal, single-writer-at-a-time flow, and keeps the DB side simple.

No migrations were run — copy the SQL blocks above into the Supabase SQL Editor when ready.
