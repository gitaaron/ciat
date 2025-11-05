# Transaction Management

### Overview
Search, filter, sort, annotate, and correct transactions in a consolidated view.

### User Goals
- Quickly find transactions and adjust categories/notes.
- Understand spending trends over time.
- Make multiple category changes efficiently before saving.

### Functional Requirements
- Show **list of all transactions** with:
  - **Search** by name and amount.【19†REQUIREMENTS.md】
  - **Filter** by date range and category.【19†REQUIREMENTS.md】
  - **Sort** by date, amount, or name.【19†REQUIREMENTS.md】
  - **Edit** the transaction category.【19†REQUIREMENTS.md】
  - **Add a note** (searchable later).【19†REQUIREMENTS.md】

#### Category Editing
- **Batch editing**: Users can edit multiple transaction categories before saving.
- **Change tracking**: System tracks which transactions have been modified.
- **Batch save**: All changes are saved together in a single operation.
- **Change indicators**: Display count of pending changes.
- **Manual override**: When a user manually changes a transaction category, it is marked as a manual override.
  - Transactions with manual override are protected from automatic recategorization by rules.
  - Manual override flag (`manual_override=1`) prevents rules from changing the category in future categorization runs.
  - Category source is set to `'manual'` to indicate user-set category.
  - Manual overrides are preserved during reapply categorization operations.

#### Save Behavior
- **Fixed bottom app bar**: Save button is displayed in a fixed bottom app bar that stays visible while scrolling.
- **Button placement**: Save button is positioned on the right side of the bottom app bar.
- **Button state**: Save button is disabled until at least one transaction is modified.
- **Save feedback**: Shows loading state during save operation and success/error notifications.
- **Partial failure handling**: If some transactions fail to save, continue saving others and report which ones failed.

### UI Considerations
- Include **line graphs** for monthly breakdowns. See **Reports & Charts**.【19†REQUIREMENTS.md】
- Fixed bottom app bar with save button provides persistent access to save functionality.
- Pending changes count displayed in bottom app bar when changes exist.

### See Also
- [Reports & Charts](./REPORTS_AND_CHARTS.md)
- [Category Guessing](./CATEGORY_GUESSING.md)
- [User Overrides](./USER_OVERRIDES.md)
