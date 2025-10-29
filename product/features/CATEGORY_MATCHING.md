# Category Matching

### Overview

When importing a new transaction that has not already been assigned a category, assign it to one of the four categories using a "rules engine".

This mirrors the command‑line and import flows for consistency.

### User Goals

- Simple categorization algorithm that user can understand and control

- Correct mistakes quickly and have the system learn over time.

### Rules Engine

- matches transactions with categories based on pattern and match type

- **Pattern Matching Rule Types**:
  - `merchant_exact` – exact match on normalized merchant.
  - `merchant_contains` – substring match in normalized description.
  - `merchant_regex` – regex on normalized text.【19†REQUIREMENTS.md】


### Rule Scoring

Store and display for each rule:
- **Support**: number of matched transactions.
- **Specificity**: rule type (exact / regex / contains).
- **Priority**: calculated based on specificity, support, and source.


#### Rule Data Model

Rules are stored in the SQLite database in a `rules` table with the following schema:

```
| Field | Type | Description |
|---|---|---|
| id | string | UUID |
| match_type | enum(`exact`,`contains`,`regex`) | Rule type |
| pattern | string | Normalized pattern |
| category | string | Assigned category |
| priority | int | Execution order |
| support | int | # of matched transactions |
| exceptions | array<string> | Exclusion tokens |
| enabled | bool | Default true |
| explain | string | User defined explanation of rule |
| labels | array<string> | JSON array of labels for grouping rules |
| created_at | datetime | When the entry was first created |
| updated_at | datetime | When the entry was last updated |
```

**Storage Requirements:**
- Rules must be persisted to the SQLite database, not flat files
- Database queries must support efficient rule retrieval by category, match type, and enabled status
- Rule updates must be atomic and maintain data consistency

### UI Considerations
- Show the **guessed category** and allow inline correction per transaction.
- Offer a short **“why” explanation** when a rule matched (from `explain`).

### See Also
- [User Overrides](./USER_OVERRIDES.md)
- [New Category Wizard](./NEW_CATEGORY_WIZARD.md)
- [Transaction Management](./TRANSACTION_MANAGEMENT.md)
