# Category Targets

### Overview
As a part of the reporting dashboard, there should be a way to configure target percentages for each category based on net income and compare against historical spending.

### User Goals
- Set personal targets (with intelligent defaults calculated from transaction history)
- Reset targets to calculated defaults based on actual spending
- See historical averages and surplus/deficit compared with desired targets

### Functional Requirements
- A target is the desired percentage of income spent on each category. (eg/ if monthly income is $10,000 and target is 10% for investments then the desired spending for investments is $1000 in that month)
- Allow the user to configure each target percentage; they should always add up to 100
- For each category, show the difference between the target and actual spending as tallied over time
- Near each target, also show a **historical average** for reference.

### Default Target Calculation
When the user has not manually set targets, the system calculates intelligent defaults using the following heuristic:
- **Investments**: Fixed at 10%
- **Fixed Costs**: Set to match actual spending (target = actual) so deviation is $0
- **Guilt Free**: Set to match actual spending (target = actual) so deviation is $0
- **Short Term Savings**: Set as the remainder to ensure all four categories sum to 100%

The calculation is based on **total** values (total inflow vs total outflow) for each category, not monthly averages. This ensures that when defaults are applied, the deviation for Fixed Costs and Guilt Free will be exactly $0.

**Fallback defaults** (used when there are no transactions or no income):
- Fixed Costs: 35%
- Investments: 10%
- Guilt Free: 40%
- Short Term Savings: 15%

Target percentages are stored with 5 decimal place precision internally, but displayed without trailing zeros (e.g., "10%" instead of "10.00000%", but "10.12345%" is shown as-is).

### UX
- This section should be at the top of the reporting dashboard.
- The difference between target and actual should be called 'surplus' (color coded green) or 'deficit' (color coded red)
- The average should just be labeled 'avg'
- A "Reset to Default" button is available next to "Edit Targets" that recalculates and applies the default targets based on current transaction data
- When editing targets, the "Reset to Default" button updates the temporary values so the user can review before saving

### See Also
- [Reports & Charts](./REPORTS_AND_CHARTS.md)
