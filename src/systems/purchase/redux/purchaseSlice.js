import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  indents: [],
  pos: [],
  indentCounter: 1,
  poCounter: 1,
};

function collectPOFormData(form, items) {
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const taxAmount = items.reduce((s, it) => {
    const amt = (Number(it.qty) || 0) * (Number(it.rate) || 0);
    return s + amt * ((Number(it.tax) || 0) / 100);
  }, 0);
  const discount = Number(form.discount) || 0;
  return {
    ...form,
    items: items.map((it) => ({ ...it })),
    total,
    taxAmount,
    discount,
    grandTotal: total + taxAmount - discount,
  };
}

const purchaseSlice = createSlice({
  name: 'purchase',
  initialState,
  reducers: {
    importIndents(state, action) {
      const rows = action.payload;
      rows.forEach((r) => {
        if (!r.itemDetails) return;
        const uid = 'IND/' + new Date().getFullYear() + '/' + String(state.indentCounter).padStart(4, '0');
        state.indentCounter += 1;
        state.indents.push({
          id: uid,
          itemDetails: r.itemDetails,
          category: r.category || 'Uncategorized',
          vendor: r.vendor || '',
          unit: r.unit || 'Pcs.',
          altUnit: r.altUnit || '',
          parentGroup: r.parentGroup || '',
          shelfCapacity: r.shelfCapacity || '',
          maxLevelQty: Number(r.maxLevelQty) || 0,
          rolQty: Number(r.rolQty) || 0,
          clQty: Number(r.clQty) || 0,
          conversionUnit: r.conversionUnit || '',
          orderFormula: Number(r.orderFormula) || 0,
          status: 'Pending',
          remarks: '',
          decidedAt: null,
          approvedQty: null,
          history: [],
          poNo: null,
          poId: null,
        });
      });
    },

    decideCategory(state, action) {
      const { ids, qtyById, status, remarks } = action.payload;
      state.indents.forEach((item) => {
        if (!ids.includes(item.id)) return;
        if (item.status !== 'Pending') {
          item.history.push({ status: item.status, remarks: item.remarks, decidedAt: item.decidedAt, approvedQty: item.approvedQty });
        }
        const newQty = qtyById[item.id] != null ? qtyById[item.id] : item.orderFormula;
        item.approvedQty = newQty;
        item.status = status;
        item.remarks = remarks;
        item.decidedAt = new Date().toLocaleString('en-IN');
      });
    },

    submitNewPO(state, action) {
      const { form, items } = action.payload;
      const data = collectPOFormData(form, items);
      const baseNo = data.poNo;
      const newPO = { id: 'PO-' + state.poCounter, baseNo, revision: 1, previousVersions: [], ...data };
      state.poCounter += 1;
      state.pos.push(newPO);
      const affectedIds = new Set(data.items.filter((it) => it.indentId).map((it) => it.indentId));
      state.indents.forEach((rec) => {
        if (affectedIds.has(rec.id)) {
          rec.poNo = newPO.poNo;
          rec.poId = newPO.id;
        }
      });
    },

    revisePO(state, action) {
      const { poId, form, items } = action.payload;
      const existing = state.pos.find((p) => p.id === poId);
      if (!existing) return;
      const data = collectPOFormData(form, items);
      const snapshot = JSON.parse(
        JSON.stringify({
          poNo: existing.poNo,
          poDate: existing.poDate,
          vendor: existing.vendor,
          shipTo: existing.shipTo,
          requisitioner: existing.requisitioner,
          shipVia: existing.shipVia,
          fob: existing.fob,
          shipTerms: existing.shipTerms,
          items: existing.items,
          terms: existing.terms,
          total: existing.total,
          discount: existing.discount,
          grandTotal: existing.grandTotal,
        }),
      );
      existing.previousVersions = existing.previousVersions || [];
      existing.previousVersions.push({ ...snapshot, revisedAt: new Date().toLocaleString('en-IN') });
      existing.revision = (existing.revision || 1) + 1;
      const revisedPoNo = existing.baseNo + '-R' + (existing.revision - 1);
      Object.assign(existing, data);
      existing.poNo = revisedPoNo;
    },
  },
});

export const { importIndents, decideCategory, submitNewPO, revisePO } = purchaseSlice.actions;
export default purchaseSlice.reducer;
