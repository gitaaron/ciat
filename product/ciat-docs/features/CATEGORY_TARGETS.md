# Category Targets

### Overview
As a part of the reporting dashboard, there should be a way to configure target percentages for each category based on net income and compare against historical spending.

### User Goals
- Set personal targets (Default: Fixed 35%, Short‑Term 15%, Guilt Free 40%, Investments 10%).
- See historical averages and surplus/deficit compared with desired targets

### Functional Requirements
- A target is the desired percentage of income spent on each category. (eg/ if monthly income is $10,000 and target is 10% for investments then the desired spending for investments is $1000 in that month)
- Allow the user to configure each target percentage; they should always add up to 100
- For each category, show the difference between the target and actual spending as tallied over time
- Near each target, also show a **historical average** for reference.

### UX
- This section should be at the top of the reporting dashboard.
- The difference between target and actual should be called 'surplus' (color coded green) or 'defecit' (color coded red)
- The average should just be labeled 'avg'

### See Also
- [Reports & Charts](./REPORTS_AND_CHARTS.md)
