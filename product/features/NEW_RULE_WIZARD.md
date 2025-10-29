# New Rule Wizard

### Overview
A guided flow to create/edit rules based on user overrides, preview affected transactions, and reapply categorization.

### User Goals
- Turn a one‑off correction into a reusable rule.
- Preview the impact before committing changes.

### Functional Requirements
- When a new override rule is created, **present all impacted transactions for review** before saving.【19†REQUIREMENTS.md】
- Allow updating the rule or creating **multiple rules**; **most recent takes highest precedence**.【19†REQUIREMENTS.md】
- After saving, **reapply categorization across all transactions** to align with the latest rules.【19†REQUIREMENTS.md】
- **Rule editing behavior**:
    - When editing a rule, changes to match type or pattern trigger a full re-match of all transactions
    - Changes to category or labels only update the rule without re-matching
    - If a rule edit results in zero matching transactions, show a confirmation dialog asking if the user wants to remove the rule
    - If a rule edit causes other lower-priority rules to lose all matches, automatically remove those empty rules
    - Provide a "Cancel" button that reverts the rule to its original state before editing
    - Show progress indicators during save operations to prevent UI freezing
- **Bug behavior**: If preview is requested with **no transactions imported**, do not error; indicate that the rule currently affects **0 transactions**.
- **Rules must be persisted to the SQLite database** in the `rules` table, not flat files.
- Rule creation and updates must be atomic database operations to ensure data consistency.

### UI Considerations
- Provide “Expand” to view transactions affected by a rule.

### See Also
- [User Overrides](./USER_OVERRIDES.md)
- [Transaction Management](./TRANSACTION_MANAGEMENT.md)
- [Import Transactions](./IMPORT_TRANSACTIONS.md)
