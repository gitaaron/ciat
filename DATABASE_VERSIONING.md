# Database Versioning System

This project includes a comprehensive database versioning system that automatically tracks changes to your SQLite database and provides tools for managing versions.

## Features

- **Automatic Change Detection**: Watches for database changes and creates versions automatically
- **Manual Version Creation**: Create versions with custom descriptions
- **Version Management**: List, revert, and delete database versions
- **CLI Interface**: Command-line tools for database management
- **Web Interface**: Built-in web UI for version management
- **Backup Safety**: Automatic backups before reverting

## Getting Started

### Automatic Versioning

When you run `npm run dev`, the system automatically:
1. Creates an initial version if none exist
2. Starts watching for database changes every 5 seconds
3. Creates new versions when changes are detected

### Manual Version Management

#### CLI Commands

```bash
# List all versions
npm run db list

# Create a new version
npm run db create "Description of changes"

# Revert to a specific version (interactive confirmation or --force flag)
npm run db revert <version-id>
npm run db revert <version-id> -- --force

# Delete a version (interactive confirmation or --force flag)
npm run db delete <version-id>
npm run db delete <version-id> -- --force

# Wipe ALL versions (interactive confirmation or --force flag)
npm run db wipe
npm run db wipe -- --force

# Clear ALL data from database (transactions and accounts)
npm run db clear
npm run db clear -- --force

# Start watching for changes
npm run db watch

# Show database status
npm run db status

# Clean up old versions (keep last 10)
npm run db cleanup
```

**Alternative Direct CLI Usage** (if npm script arguments don't work properly):

```bash
# Run CLI directly from backend directory
cd backend

# Delete a version
node src/cli.js delete <version-id> --force

# Wipe ALL versions
node src/cli.js wipe --force

# Revert to a version
node src/cli.js revert <version-id> --force
```

**Note**: For commands that require the `--force` flag, use `-- --force` to separate npm's `--force` from the CLI's `--force` flag. If this doesn't work, use the direct CLI approach.

**Interactive Confirmation**: When running commands without the `--force` flag, the CLI will prompt for confirmation. Type `y` or `yes` to confirm, or `n`/`no`/anything else to cancel.

**Important Command Differences**:
- **`wipe`** - Deletes all database version snapshots (backups), but keeps your actual data intact
- **`clear`** - Deletes all transactions and accounts from the database (this removes your actual data!)
- **`delete <version-id>`** - Deletes a specific version snapshot
- **`revert <version-id>`** - Restores the database to a previous version snapshot

#### Web Interface

1. Start the application: `npm run dev`
2. Navigate to the "Database Versions" tab
3. Use the web interface to:
   - View all versions
   - Create new versions
   - Revert to previous versions
   - Delete old versions

## How It Works

### Version Storage

- Versions are stored in `backend/data/versions/`
- Each version consists of:
  - `{version-id}.sqlite`: Complete database snapshot
  - `{version-id}.json`: Metadata (timestamp, description, hash, size)

### Change Detection

The system calculates a hash of the entire database (schema + data) and compares it with the previous hash. When changes are detected, a new version is automatically created.

### Version IDs

Version IDs follow the format: `{timestamp}-{hash-prefix}`
- Example: `2024-01-15T10-30-45-123Z-a1b2c3d4`

### Safety Features

- **Automatic Backups**: Before reverting, the current database is backed up
- **Hash Verification**: Each version includes a hash for integrity checking
- **Confirmation Prompts**: CLI commands require confirmation for destructive operations

## API Endpoints

The system provides REST API endpoints for programmatic access:

- `GET /api/versions` - List all versions
- `POST /api/versions` - Create a new version
- `GET /api/versions/status` - Get current database status
- `POST /api/versions/:id/revert` - Revert to a version
- `DELETE /api/versions/:id` - Delete a version

## Configuration

### Watch Interval

The default watch interval is 5 seconds. You can customize this:

```bash
# Watch with 10-second intervals
npm run db watch --interval 10000
```

### Version Retention

By default, the system keeps the 10 most recent versions. Clean up old versions:

```bash
# Keep only 5 most recent versions
npm run db cleanup --keep 5

# Wipe ALL versions (complete cleanup)
npm run db wipe -- --force

# Alternative direct CLI usage
cd backend && node src/cli.js wipe --force
```

**⚠️ Warning**: The `wipe` command permanently deletes ALL database versions. Use with extreme caution!

## Best Practices

1. **Regular Cleanup**: Periodically clean up old versions to save disk space
2. **Descriptive Names**: Use meaningful descriptions when creating manual versions
3. **Test Reverts**: Test reverting to previous versions in development before production
4. **Monitor Disk Usage**: Version files can accumulate over time

## Troubleshooting

### Version Not Found
- Check the version ID is correct: `npm run db list`
- Ensure the version file exists in `backend/data/versions/`

### Permission Errors
- Ensure the application has write permissions to `backend/data/`
- Check that the versions directory exists and is writable

### Large Version Files
- Use `npm run db cleanup` to remove old versions
- Consider reducing the watch interval if versions are created too frequently

## File Structure

```
backend/
├── data/
│   ├── ciat.sqlite          # Main database
│   └── versions/            # Version storage
│       ├── 2024-01-15T10-30-45-123Z-a1b2c3d4.sqlite
│       ├── 2024-01-15T10-30-45-123Z-a1b2c3d4.json
│       └── ...
├── src/
│   ├── versioning.js        # Core versioning logic
│   ├── cli.js              # CLI interface
│   └── server.js           # API endpoints
```

## Integration

The versioning system is automatically integrated with:
- `npm run dev` - Starts versioning with the development server
- Database operations - All changes are tracked
- Import process - New transactions trigger version creation
- Manual categorization - Category changes are tracked
