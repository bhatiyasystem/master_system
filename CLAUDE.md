# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server (HMR)
npm run build      # ESLint check + production build to dist/
npm run lint       # ESLint only
npm run preview    # Preview the production build locally
npm start          # Run Express proxy server on port 5000 (server.js)
```

No test suite is configured. There is no `npm test` command.

## Architecture

This is a **multi-system enterprise dashboard** (Bhatia Enterprises) built as a single Vite + React 18 app. Four independent subsystems plug into a central shell via a **System Registry pattern**.

### Core Shell (`src/core/`, `src/App.jsx`)

- `src/App.jsx` — Root router. Imports all four system index files (side-effect imports that trigger registration), then maps `systemRegistry.getAllSystems()` to React Router routes dynamically.
- `src/core/registry/systemRegistry.js` — Singleton registry. Systems call `systemRegistry.register({ id, name, menuItems, routes })` on import.
- `src/core/layout/MasterLayout.jsx` — Shared sidebar + header shell. Reads registered `menuItems` and filters by user role (`showFor`).
- `src/core/authentication/ProtectedRoute.jsx` / `SuperAdminRoute.jsx` — Route guards wrapping system routes.

All protected routes live under the `/dashboard/` prefix. Auth state is stored in `localStorage` (keys: `user-name`, `role`, `is-super-admin`, `user-id`). The master system uses Supabase for its own auth (`src/SupabaseClient.js`).

### The Four Systems

Each system lives in `src/systems/<name>/` with its own pages, components, services, and a root `index.jsx` that calls `systemRegistry.register()`.

**1. Checklist & Delegation** (`src/systems/checklist-delegation/`)
- Redux-heavy: task assignments, quick tasks, delegation, checklists, maintenance, repair, EA tasks.
- State in `src/redux/` (slices + API files per feature).
- Routes under `/dashboard/` (e.g. `/dashboard/assign-task`).

**2. MIS Summary** (`src/systems/mis_summary/`)
- Reads from a Google Apps Script Web App (`VITE_APPS_SCRIPT_URL`).
- Has its own internal `AuthContext`. The `MasterAuthBridgeProvider` + `MisAuthBridgeInjector` in `src/context/MasterAuthBridgeContext.jsx` inject the master session into it — no re-login required.
- Routes under `/dashboard/mis-*`.

**3. HR FMS** (`src/systems/HR_fms/`)
- Has its own Supabase instance (`VITE_HR_SUPABASE_URL`) and its own sidebar/layout inside `src/systems/HR_fms/src/`.
- Auth bridge: `HrFmsPageWrapper` in `src/systems/HR_fms/index.jsx` fetches the user from a Google Sheets Apps Script on first load, writes `user` and `employeeId` to `localStorage`, and then renders the child page.
- HR FMS pages read `localStorage.getItem('user')` directly (expects `{ Username, Name, Admin: 'Yes'|'No' }`).
- Pages must **not** add their own margin/padding wrappers — the `MasterLayout` + `Layout.jsx` inside HR FMS already handle this. Page root divs should use `className="space-y-N"` only (no `ml-*`, `p-*`, `min-h-screen`).
- Routes under `/dashboard/hr-*`.

**4. WhatsApp Management** (`src/systems/whatsapp-management/`)
- Calls the WhatsApp Business API (`VITE_WHATSAPP_API_URL`).
- Admin-only. One route: `/dashboard/whatsapp-history`.

### State Management

Redux Toolkit store in `src/redux/store.js`. Only the Checklist & Delegation system uses Redux; other systems manage state locally with `useState`/`useEffect` + direct Supabase/API calls.

### Supabase Clients

| Client | Env vars | Used by |
|--------|----------|---------|
| `src/SupabaseClient.js` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Master auth, Checklist, notifications |
| `src/systems/HR_fms/src/services/supabaseHR.js` | `VITE_HR_SUPABASE_URL`, `VITE_HR_SUPABASE_ANON_KEY` | All HR FMS data |

### Adding a New System

1. Create `src/systems/<your-system>/index.jsx` and call `systemRegistry.register({ id, name, icon, menuItems, routes })`.
2. Import it in `src/App.jsx` as a side-effect import.
3. Each route's `element` should be a React element (not a component reference). Wrap with an auth bridge component if the system has its own auth.

### Key Conventions

- **Roles**: `admin`, `HOD`, `user`. Menu `showFor` and route `allowedRoles` use these strings.
- **HR FMS localStorage contract**: HR pages check `JSON.parse(localStorage.getItem('user')).Admin === 'Yes'` to gate admin features. The `employeeId` key holds the employee's ID from the JOINING Google Sheet.
- **Icons in menu items**: Passed as strings (e.g. `icon: 'LayoutDashboard'`); `MasterLayout` resolves them from Lucide React.
- **Express server** (`server.js`): Only needed if proxying Google Apps Script calls server-side. The Vite dev server is separate — run both if MIS features are needed locally.
