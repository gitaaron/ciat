# Persistence

### Overview
Ensure data survives page refreshes and application restarts; maintain versioned database snapshots for recovery.

### Functional Requirements
- Persist **all data to disk** so the app is resilient to refresh/restart.
- **Rules must be stored in the SQLite database** instead of flat files (e.g., `rules.json`).
- The SQLite database file is ignored by Git, but **versioned externally** with snapshots and a **CLI** to list and revert versions (see Architecture).

### Database Schema Requirements
- Rules table must include all rule properties: id, match_type, pattern, category, priority, enabled, explain, labels, created_at, updated_at
- Rules must be queryable by category, match type, and enabled status
- Rules must support efficient pattern matching for transaction categorization

### See Also
- [Architecture](../dev/ARCHITECTURE.md)
