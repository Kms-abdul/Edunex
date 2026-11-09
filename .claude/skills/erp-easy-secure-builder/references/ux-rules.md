# UX rules for KampusOps (unskilled users)

## Words
- Short, everyday English. "Save fee", not "Submit transaction". "Class", not "Grade master".
- Button labels start with a verb: Save, Add, Mark present, Print receipt.
- Errors say what happened and what to do: "This admission number is already used. Check the number or search the student."
- Never show raw error text, stack traces, HTTP codes or field names like `class_id`.

## Layout
- One screen = one task. Put the main button last in the form (sticky at the bottom on phones via `ActionBar`).
- Maximum ~6 fields visible at once on a phone; split longer forms into steps (`Steps` component).
- Show where the user is (page title + breadcrumb trail such as "Enter Marks > Subject wise").
- Long menus become grouped dropdowns (`ModuleMenuBar`) or tile grids (`ModuleTile`).

## Defaults and prevention
- Pre-fill: today's date, selected academic year (header), current branch, last used class/section.
- Use searchable inputs for students/staff; never a dropdown with hundreds of rows.
- Disable a button until the form is valid; validate as the user types.
- Destructive actions use `confirmDialog` with plain words ("Delete receipt 1023? This cannot be undone.").
- After success: `notify` with a short message and offer the obvious next action (e.g. "Print receipt").

## States
- Loading: `LoadingState` / `Spinner`. Empty: `EmptyState` with the next action. Failure: `ErrorState` with "Try again".
- Keep typed data when a save fails.

## Language
- Keep user-visible text in one place per screen (constants at top), ready for translation later.
