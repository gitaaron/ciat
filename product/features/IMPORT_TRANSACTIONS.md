# Import Transactions

### Overview

Import historical transactions from multiple accounts using common bank formats, map files to accounts, and pre‑categorize with the standard algorithm.

### User Goals
- Drag/drop files for each account one at a time.
- Review rules with their matched transactions and correct categories before saving.

### Functional Requirements
- Support **.csv** (comma or tab delimited) and **.qfx** (Quicken) file formats.
- Drag/drop a **single file per account** in one go.
- Post‑import flow: prompt user to **select the account** for each file via dropdown; support **creating accounts** in an “Accounts” section (list, rename, delete).
- Attempt initial **category guess** for each transaction based on current rules.
- **Deduplicate** if the same transaction is imported more than once.
- Show **rules created** rather than lists of transactions to revieww; clicking **Expand** reveals affected transactions; allow **edit/delete** rules with preview. Categories shown step‑by‑step: **Fixed → Investments → Guilt Free → Short‑Term**.
    - When previewing the rule, it should be possible to edit the rule (match type, pattern, category)
    - In the expanded 'transactions' section I should be able to click a button on each transaction to create a new rule from the transaction. 
        - Clicking 'create rule' should open a dialog where i can edit the pattern/category/match type.  After creating the new rule it should appear at the top of the list of rules to apply and take precedence over all previous rules and all transactions should be updated based on the new rule. 
- The **same categorization algorithm** is used in CLI and import flows.
- During import, the 'rules review' and 'auto rules review' should be completed in the same step.  Any pre-existing rules should have a higher priority (and thus appear first before any auto generated rules).  The pre-existing rules should appear in a separate section from the auto generated rules so they are distinct to the user.
- **Rule Matching Order**: Rules are tested in priority order (highest priority first). Once a transaction matches a rule, it is not tested against subsequent rules. This ensures each transaction is assigned to exactly one category based on the first matching rule.

### UI Considerations
- After parsing, provide a **review** before save (with inline category edit and optional note).

### See Also
- [Transaction Management](./TRANSACTION_MANAGEMENT.md)
- [Category Guessing](./CATEGORY_GUESSING.md)
- [New Category Wizard](./NEW_CATEGORY_WIZARD.md)
