# Code patterns for KampusOps

## Backend (erp-backend/)
- One blueprint per module in `routes/` (e.g. `hr_routes.py`, `academic_routes.py`), registered in `app.py`.
- Models in `models.py` (timetable models in `timetable_models.py`); every business table has `school_id` and `branch_id` and uses `AuditMixin`.
- Schema changes only through Flask-Migrate:
  - `python -m flask --app app:create_app db migrate -m "short message"`
  - review the generated file, then `python -m flask --app app:create_app db upgrade`
- Put unique constraints / foreign keys / NOT NULL / indexes in the model and migration, not just in code checks.
- Permissions: add new codes to `permission_catalog.py` (dashboard, module, component, code) and check them with `has_permission`.
- Number sequences (admission no, staff code) use sequence tables with `SELECT ... FOR UPDATE`; reuse that pattern for any new running number.
- Keep business rules in small helper functions (or `services/`), routes only parse input, call helpers, return JSON.
- Tests: pytest with the SQLite compile shim used in existing tests; cover permissions, duplicates and money calculations.

## Frontend (frontend/)
- Pages are lazy-loaded in `components/Dashboard.tsx`; page names are in the `Page` union in `App.tsx`; routing is hash-based.
- Use `API_URL` from `src/config` and the shared UI kit in `components/ui/`.
- Navigation sections live in `components/shell/nav.tsx`; module menus use `ModuleMenuBar` (Academics) or tabs + tiles (Finance).
- Permission-gate every menu item with `hasPermission(code, 'read')` from `useAuth()`; hide empty groups.
- Run `npx tsc --noEmit -p .` and `npm run build` before committing.

## Git
- Work and push on branch `Payroll`; small commits with clear messages; never commit `.env`, uploaded logos or local databases.
