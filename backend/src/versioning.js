import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
const versionsDir = path.join(dataDir, 'versions');

// Ensure versions directory exists
if (!fs.existsSync(versionsDir)) {
  fs.mkdirSync(versionsDir, { recursive: true });
}

class DatabaseVersioner {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.versionsDir = versionsDir;
    this.watchers = new Map();
    this.lastHash = null;
    this.isWatching = false;
  }

  // Calculate hash of current database state
  calculateDatabaseHash() {
    const db = new Database(this.dbPath);
    try {
      // Get all table data and schema
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      let content = '';
      
      for (const table of tables) {
        // Get schema
        const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table.name);
        content += schema.sql + '\n';
        
        // Get data
        const data = db.prepare(`SELECT * FROM ${table.name}`).all();
        content += JSON.stringify(data) + '\n';
      }
      
      return crypto.createHash('sha256').update(content).digest('hex');
    } finally {
      db.close();
    }
  }

  // Create a version snapshot
  createVersion(description = '') {
    const timestamp = new Date().toISOString();
    const hash = this.calculateDatabaseHash();
    const versionId = `${timestamp.replace(/[:.]/g, '-')}-${hash.substring(0, 8)}`;
    
    const versionPath = path.join(this.versionsDir, `${versionId}.sqlite`);
    
    // Copy current database to version
    fs.copyFileSync(this.dbPath, versionPath);
    
    // Create metadata file
    const metadata = {
      id: versionId,
      timestamp,
      description,
      hash,
      size: fs.statSync(versionPath).size
    };
    
    const metadataPath = path.join(this.versionsDir, `${versionId}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`Created version: ${versionId} - ${description}`);
    return versionId;
  }

  // List all versions
  listVersions() {
    const files = fs.readdirSync(this.versionsDir);
    const versions = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const metadataPath = path.join(this.versionsDir, file);
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        versions.push(metadata);
      }
    }
    
    return versions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // Revert to a specific version
  revertToVersion(versionId) {
    const versionPath = path.join(this.versionsDir, `${versionId}.sqlite`);
    const metadataPath = path.join(this.versionsDir, `${versionId}.json`);
    
    if (!fs.existsSync(versionPath) || !fs.existsSync(metadataPath)) {
      throw new Error(`Version ${versionId} not found`);
    }
    
    // Create backup of current database
    const backupPath = `${this.dbPath}.backup.${Date.now()}`;
    fs.copyFileSync(this.dbPath, backupPath);
    console.log(`Created backup: ${backupPath}`);
    
    // Restore version
    fs.copyFileSync(versionPath, this.dbPath);
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    console.log(`Reverted to version: ${versionId} (${metadata.timestamp})`);
    return metadata;
  }

  // Delete a version
  deleteVersion(versionId) {
    const versionPath = path.join(this.versionsDir, `${versionId}.sqlite`);
    const metadataPath = path.join(this.versionsDir, `${versionId}.json`);
    
    if (fs.existsSync(versionPath)) fs.unlinkSync(versionPath);
    if (fs.existsSync(metadataPath)) fs.unlinkSync(metadataPath);
    
    console.log(`Deleted version: ${versionId}`);
  }

  // Start watching for changes
  startWatching(intervalMs = 5000) {
    if (this.isWatching) {
      console.log('Already watching for changes');
      return;
    }
    
    this.isWatching = true;
    this.lastHash = this.calculateDatabaseHash();
    
    console.log('Started watching database for changes...');
    
    this.watchInterval = setInterval(() => {
      const currentHash = this.calculateDatabaseHash();
      if (currentHash !== this.lastHash) {
        console.log('Database changes detected, creating version...');
        this.createVersion('Auto-version from change detection');
        this.lastHash = currentHash;
      }
    }, intervalMs);
  }

  // Stop watching for changes
  stopWatching() {
    if (!this.isWatching) {
      return;
    }
    
    this.isWatching = false;
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    
    console.log('Stopped watching database for changes');
  }

  // Clean up old versions (keep last N versions)
  cleanupVersions(keepCount = 10) {
    const versions = this.listVersions();
    if (versions.length <= keepCount) {
      console.log(`No cleanup needed. Current versions: ${versions.length}`);
      return;
    }
    
    const toDelete = versions.slice(keepCount);
    for (const version of toDelete) {
      this.deleteVersion(version.id);
    }
    
    console.log(`Cleaned up ${toDelete.length} old versions`);
  }

  // Wipe all versions (complete cleanup)
  wipeAllVersions() {
    const versions = this.listVersions();
    if (versions.length === 0) {
      console.log('No versions to wipe');
      return;
    }
    
    for (const version of versions) {
      this.deleteVersion(version.id);
    }
    
    console.log(`Wiped ${versions.length} versions`);
  }

  // Clear all data from the database (transactions, accounts, and rules)
  clearAllData() {
    const db = new Database(this.dbPath);
    try {
      // Delete all transactions
      const txResult = db.prepare('DELETE FROM transactions').run();
      console.log(`Deleted ${txResult.changes} transactions`);
      
      // Delete all accounts
      const accountResult = db.prepare('DELETE FROM accounts').run();
      console.log(`Deleted ${accountResult.changes} accounts`);
      
      // Delete all rules
      const rulesResult = db.prepare('DELETE FROM rules').run();
      console.log(`Deleted ${rulesResult.changes} rules`);
      
      console.log('✅ Successfully cleared all data from database');
    } finally {
      db.close();
    }
  }
}

// Create singleton instance
const dbPath = path.join(dataDir, 'ciat.sqlite');
export const versioner = new DatabaseVersioner(dbPath);

// Auto-cleanup on process exit
process.on('SIGINT', () => {
  versioner.stopWatching();
  process.exit(0);
});

process.on('SIGTERM', () => {
  versioner.stopWatching();
  process.exit(0);
});
