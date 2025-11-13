# Reports & Charts

### Overview
Visualize spending by category and trends over time.

### User Goals
- See where money flows at a glance.
- Track monthly changes.

### Functional Requirements
- **Pie chart** for the breakdown of money flow into each category.
- **Line graphs** showing monthly spending breakdowns.
- Include 'Category Targets' in this tab
- **Date filters**: Start and end date filters that apply to all sections of the reports:
  - Uses the same filter component as the Transactions tab (promoting DRY)
  - Start date is prepopulated with the date of the first transaction in history
  - End date is prepopulated with the date of the last transaction in history
  - "Reset" button resets the date range to the full transaction history
  - Filters apply to: Category Targets, Net Income, Pie Chart, and Line Chart sections
- **Auto-refresh**: Reports automatically refresh when transaction categories are modified in the Transactions table

### Tech Notes
- Frontend uses **D3.js** for charting (see Architecture).

### UX
- If there are no transactions imported yet, this tab should simply display a message saying no transactions have been imported yet.
- Date filters are displayed in a card at the top of the Reports tab with a "Reports" title.
- Date filters are only shown when transactions exist.

### See Also
- [Transaction Management](./TRANSACTION_MANAGEMENT.md)
- [Category Targets](./CATEGORY_TARGETS.md)
