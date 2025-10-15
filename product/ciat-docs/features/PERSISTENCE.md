# Persistence

### Overview
Ensure data survives page refreshes and application restarts; maintain versioned database snapshots for recovery.

### Functional Requirements
- Persist **all data to disk** so the app is resilient to refresh/restart.
- The SQLite database file is ignored by Git, but **versioned externally** with snapshots and a **CLI** to list and revert versions (see Architecture).

### See Also
- [Architecture](../architecture/ARCHITECTURE.md)
