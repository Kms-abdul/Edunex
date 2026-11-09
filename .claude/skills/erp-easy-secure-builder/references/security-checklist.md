# Security checklist for KampusOps

## Every API route (Flask)
- [ ] `@token_required` first, then a permission check (`has_permission(user, code, action)`).
- [ ] Ownership check: the record's `school_id` / `branch_id` must be in the user's allowed branches (`get_user_allowed_branches`). Never trust an ID from the URL or body alone.
- [ ] Student / parent tokens (when added) must be rejected by staff/admin routes, and may only read their own student's data.
- [ ] Validate every input on the server (type, length, allowed values). Frontend validation is only convenience.
- [ ] SQLAlchemy queries or bound parameters only; no f-strings / string concatenation in SQL.
- [ ] Money, marks and multi-table writes inside one transaction; roll back on error.
- [ ] Return generic messages to the user; log details with `logger.exception` (never log passwords, PINs, tokens, full Aadhaar).

## Login and passwords
- [ ] Hash with werkzeug `generate_password_hash` (existing `hash_user_password`). Never store or return plain passwords/PINs.
- [ ] Rate-limit login / OTP (`limiter`), count failures, temporary lock-out, same error for wrong user or wrong password.
- [ ] Temporary passwords/PINs force a change on first login (`is_first_login`).

## Sensitive data
- [ ] Aadhaar, phone numbers: show masked (last 4 digits) unless the role needs full value.
- [ ] Never put sensitive values in URLs, query strings or logs.
- [ ] Tokens/secrets (SMS, Zoom, etc.) stored encrypted (`crypto_utils`), never sent to the frontend.

## Auth token in the browser
- The app uses a Bearer JWT, so classic cookie CSRF does not apply; protect against XSS instead: no `dangerouslySetInnerHTML` with user data, no `eval`, keep dependencies updated.
- If cookies are ever introduced: Secure, HttpOnly, SameSite=Lax/Strict, plus CSRF tokens.

## File uploads
- [ ] Allow-list extensions and MIME types, size limit, generate a new file name, store outside the web root, serve through an authorised route.

## Config
- [ ] Secrets only in `.env` / environment (SECRET_KEY, FERNET_KEY, DB_*). Never commit `.env`.
- [ ] `DEBUG=False` in production; HTTPS only.

## Audit
- [ ] Changes to fees, receipts, marks and personal data are recorded (AuditMixin / audit_logs) with user and time.
