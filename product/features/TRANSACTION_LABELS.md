# Transaction Labels

### Overview

Transaction labels provide a way to group transactions besides the standard four categories.

Labels can later be used for reporting and search purposes (eg/ providing a line chart of monthly spending by label).

### Functional Requirements

When creating or editing rules, it should be possible to include an optional label.

When a rule is applied to a transaction it then applies the category along with the label.

Any time I can edit or create the rule (including during the import transactions flow) I should also be able to add a label.

When adding the label to a rule, it should be a search for previously created labels or a button to create a new one based on what i've entered in the text box.

I should be able to add more than one label to each rule.

I should also be able to remove labels from the rule.

### Automatic Labels

#### Transfer Detection
- During import, the system automatically detects transactions that appear to be transfers between accounts.
- Transfer detection uses two methods:
  1. **Amount and date matching**: Pairs opposite-signed amounts between different accounts on the same date
  2. **Keyword matching**: Identifies common transfer patterns in transaction names (e.g., "transfer", "payment", "bill payment", "autopay")
- Transactions detected as transfers are automatically labeled with the `'transfer'` label
- **Important**: Transfer transactions are still saved to the database (not filtered out) and can be viewed, categorized, and filtered like any other transaction
- The `'transfer'` label is preserved when rules are applied to transactions (merged with rule labels)
- Users can filter transactions by the `'transfer'` label to view all transfer transactions
