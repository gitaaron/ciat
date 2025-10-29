# Common Utilities

This folder contains shared utilities used by both the frontend and backend of the CIAT application.

## Rule Matching (`src/ruleMatcher.js`)

Contains the core rule matching logic that ensures consistency between frontend and backend rule application:

- `normalizeMerchant()` - Normalizes merchant names for consistent pattern matching
- `matchesRule()` - Checks if a transaction matches a specific rule
- `applyRulesToTransactions()` - Applies rules to a list of transactions
- `applyRulesWithDetails()` - Applies rules and returns detailed matching information
- `getTransactionsForRule()` - Gets transactions that match a specific rule
- `getUnmatchedTransactions()` - Gets transactions that don't match any rules

## Usage

Both frontend and backend import these functions to ensure consistent rule matching behavior across the application.

### Backend
```javascript
import { applyRulesToTransactions, matchesRule } from '../../../common/src/ruleMatcher.js';
```

### Frontend
```javascript
import { applyRulesToTransactions, matchesRule } from '../../../common/src/ruleMatcher.js';
```

## Structure

```
common/
├── package.json          # Module configuration
├── README.md            # This file
└── src/
    └── ruleMatcher.js   # Shared rule matching logic
```
