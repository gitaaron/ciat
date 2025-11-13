# Data Refresh

### Overview
This document details the events that trigger data refreshes in the application and specifies which components should be refreshed in each scenario.

### Refresh Events

#### 1. Transaction Updates / New Transactions
**Trigger**: When transaction categories are manually modified and saved in the Transactions table.

**Event**: `categories-updated` emitted from `TransactionsTable` component.

**Components Refreshed**:
- **Reports**: All charts and visualizations are refreshed to reflect updated category assignments
  - PieChart (category spend breakdown)
  - LineChart (monthly breakdown)
  - NetIncome component
  - CategoryTargets component

---

#### 2. Rules Reapply
**Trigger**: When categorization rules are reapplied to existing transactions.

**Event**: `rules-reapplied` emitted from `RuleManager` component.

**Components Refreshed**:
- **Transactions Table**: Reloads all transactions to show updated categories from rule application
- **Reports**: All charts and visualizations are refreshed to reflect new category assignments
  - PieChart (category spend breakdown)
  - LineChart (monthly breakdown)
  - NetIncome component
  - CategoryTargets component

---

#### 3. Import Complete
**Trigger**: When new transactions are imported via the Import Wizard.

**Event**: `import-complete` emitted from `ImportWizard` component.

**Components Refreshed**:
- **Transactions Table**: Reloads all transactions to include newly imported transactions
- **Reports**: All charts and visualizations are refreshed to include new transactions
  - PieChart (category spend breakdown)
  - LineChart (monthly breakdown)
  - NetIncome component
  - CategoryTargets component

**Additional Behavior**:
- Navigation automatically switches to the Reports tab after import completion
- `hasTransactions` flag is updated to reflect the new transaction state

---

### Component Refresh Methods

#### Reports Component (`Reports.vue`)
The `refresh()` method refreshes:
- Transaction data check
- PieChart component (via `pieChartRef.refresh()`)
- LineChart component (via `lineChartRef.refresh()`)
- NetIncome component (via `netIncomeRef.loadTransactions()`)
- CategoryTargets component (via `categoryTargetsRef.loadTransactions()`)

#### Transactions Table Component (`TransactionsTable.vue`)
The `loadTransactions()` method:
- Reloads all transactions from the API
- Updates the displayed transaction list
- Recalculates filters and statistics

---

### See Also
- [Transaction Management](../features/TRANSACTION_MANAGEMENT.md)
- [Reports & Charts](../features/REPORTS_AND_CHARTS.md)
- [Rule Editing](../features/RULE_EDITING.md)
- [Import Transactions](../features/IMPORT_TRANSACTIONS.md)

