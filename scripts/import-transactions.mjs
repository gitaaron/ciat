#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import backend modules
import { db } from '../backend/src/db.js';
import { Accounts, Transactions } from '../backend/src/models.js';
import { parseTransactionsCSV } from '../backend/src/utils/parseCSV.js';
import { parseTransactionsQFX } from '../backend/src/utils/parseQFX.js';
import { detectFileFormat, isSupportedFormat } from '../backend/src/utils/fileFormatDetector.js';
import { txHash } from '../backend/src/utils/hash.js';
import { parseLabels } from '../common/src/ruleMatcher.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--help':
    case '-h':
      options.help = true;
      break;
  }
}

if (options.help) {
  console.log(`
Usage: node import-transactions.mjs [options]

Import transactions from files specified in import-config.json.

Arguments:
  -h, --help                     Show this help message

Configuration File:
  The script automatically loads 'import-config.json' from the scripts directory.

Configuration File Format:
  {
    "accounts": [
      {
        "name": "Account Name",
        "file": "path/to/transactions.csv",
        "fieldMapping": {
          "0": "date",
          "1": "name",
          "2": "outflow",
          "3": "inflow",
          "4": "external_id"
        }
      }
    ]
  }

Field Mapping:
  - Maps CSV column indices (0-based) to field names
  - Required fields: date, name, outflow
  - Optional fields: inflow, external_id
  - If not specified, defaults will be used (date, name, amount, credit)

Examples:
  node import-transactions.mjs

Supported file formats:
  - CSV files (.csv) - comma or tab delimited
  - QFX files (.qfx) - Quicken Financial Exchange format

Notes:
  - Accounts will be created if they don't exist
  - Duplicate transactions (based on hash) will be skipped
  - File paths can be absolute or relative to the config file location
`);
  process.exit(0);
}

// Always load import-config.json from the scripts directory
const configPath = path.join(__dirname, 'import-config.json');

if (!fs.existsSync(configPath)) {
  console.error(`❌ Error: Config file not found: ${configPath}`);
  console.error('Please create import-config.json in the scripts directory.');
  console.error('You can copy from import-config.json.example as a starting point.');
  process.exit(1);
}

// Read and parse config file
let config;
try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configContent);
} catch (error) {
  console.error(`❌ Error: Failed to parse config file: ${error.message}`);
  process.exit(1);
}

if (!config.accounts || !Array.isArray(config.accounts) || config.accounts.length === 0) {
  console.error('❌ Error: Config file must contain an "accounts" array with at least one account');
  process.exit(1);
}

// Validate config structure
for (const account of config.accounts) {
  if (!account.name || !account.file) {
    console.error('❌ Error: Each account must have "name" and "file" properties');
    process.exit(1);
  }
  
  // Validate field mapping if provided
  if (account.fieldMapping) {
    if (typeof account.fieldMapping !== 'object') {
      console.error(`❌ Error: fieldMapping for account "${account.name}" must be an object`);
      process.exit(1);
    }
    
    // Validate field mapping keys are numeric strings and values are valid field names
    const validFields = ['date', 'name', 'outflow', 'inflow', 'external_id'];
    for (const [key, value] of Object.entries(account.fieldMapping)) {
      const index = parseInt(key, 10);
      if (isNaN(index) || index < 0) {
        console.error(`❌ Error: fieldMapping keys must be non-negative integers for account "${account.name}"`);
        process.exit(1);
      }
      if (!validFields.includes(value)) {
        console.error(`❌ Error: Invalid field name "${value}" in fieldMapping for account "${account.name}". Valid fields: ${validFields.join(', ')}`);
        process.exit(1);
      }
    }
    
    // Check required fields
    const mappingValues = Object.values(account.fieldMapping);
    if (!mappingValues.includes('date')) {
      console.error(`❌ Error: fieldMapping for account "${account.name}" must include "date" field`);
      process.exit(1);
    }
    if (!mappingValues.includes('name')) {
      console.error(`❌ Error: fieldMapping for account "${account.name}" must include "name" field`);
      process.exit(1);
    }
    if (!mappingValues.includes('outflow')) {
      console.error(`❌ Error: fieldMapping for account "${account.name}" must include "outflow" field`);
      process.exit(1);
    }
  }
}

const configDir = path.dirname(path.resolve(configPath));

async function importTransactions() {
  console.log('\n📥 Starting transaction import...\n');
  
  let totalAccounts = 0;
  let totalCreated = 0;
  let totalTransactions = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  for (const accountConfig of config.accounts) {
    const accountName = accountConfig.name;
    const filePath = accountConfig.file;
    
    // Resolve file path (relative to config file or absolute)
    const resolvedPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(configDir, filePath);
    
    console.log(`\n📋 Processing account: ${accountName}`);
    console.log(`   File: ${resolvedPath}`);
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      console.error(`   ❌ Error: File not found: ${resolvedPath}`);
      totalErrors++;
      continue;
    }
    
    // Find or create account
    let account = Accounts.findByName(accountName);
    const hasFieldMapping = accountConfig.fieldMapping && typeof accountConfig.fieldMapping === 'object';
    
    if (!account) {
      console.log(`   ➕ Creating account: ${accountName}`);
      Accounts.create(accountName);
      account = Accounts.findByName(accountName);
      totalCreated++;
      
      // Save field mapping if provided
      if (hasFieldMapping) {
        console.log(`   💾 Saving field mapping to account`);
        Accounts.updateFieldMapping(account.id, accountConfig.fieldMapping);
        account = Accounts.findByName(accountName); // Refresh to get updated mapping
      }
    } else {
      console.log(`   ✓ Account already exists: ${accountName} (ID: ${account.id})`);
      
      // Update field mapping if provided in config (overrides existing)
      if (hasFieldMapping) {
        console.log(`   💾 Updating field mapping for account`);
        Accounts.updateFieldMapping(account.id, accountConfig.fieldMapping);
        account = Accounts.findByName(accountName); // Refresh to get updated mapping
      }
    }
    totalAccounts++;
    
    // Read file
    const fileBuffer = fs.readFileSync(resolvedPath);
    const fileName = path.basename(resolvedPath);
    
    // Detect file format
    const format = detectFileFormat(fileName, fileBuffer);
    
    if (!isSupportedFormat(format)) {
      console.error(`   ❌ Error: Unsupported file format: ${format}`);
      totalErrors++;
      continue;
    }
    
    console.log(`   📄 Format: ${format.toUpperCase()}`);
    
    // Parse transactions
    let rows;
    try {
      if (format === 'csv') {
        // Use field mapping from config (if provided), otherwise from account, otherwise null
        const fieldMapping = accountConfig.fieldMapping || account.field_mapping || null;
        
        if (fieldMapping) {
          console.log(`   📋 Using field mapping: ${JSON.stringify(fieldMapping)}`);
        } else {
          console.log(`   📋 Using default column mapping`);
        }
        
        rows = parseTransactionsCSV(fileBuffer, fieldMapping);
      } else if (format === 'qfx') {
        // QFX files don't need field mapping
        rows = await parseTransactionsQFX(fileBuffer);
      }
      
      console.log(`   📊 Parsed ${rows.length} transactions`);
    } catch (error) {
      console.error(`   ❌ Error parsing file: ${error.message}`);
      totalErrors++;
      continue;
    }
    
    if (rows.length === 0) {
      console.log(`   ⚠️  No transactions found in file`);
      continue;
    }
    
    // Process and save transactions
    let saved = 0;
    let skipped = 0;
    
    for (const row of rows) {
      try {
        // Add account_id and hash to each transaction
        const hash = txHash({ ...row, account_id: account.id });
        
        // Parse labels if present
        const labels = parseLabels(row.labels || []);
        
        const tx = {
          external_id: row.external_id || null,
          account_id: account.id,
          date: row.date,
          name: row.name,
          description: row.description || '',
          amount: Number(row.amount),
          inflow: row.inflow ? 1 : 0,
          category: null, // No auto-categorization in CLI import
          category_source: null,
          category_explain: null,
          labels: labels.length > 0 ? JSON.stringify(labels) : null,
          note: null,
          hash: hash,
          manual_override: 0
        };
        
        const result = Transactions.upsert(tx);
        if (result.skipped) {
          skipped++;
        } else {
          saved++;
        }
      } catch (error) {
        console.error(`   ⚠️  Error processing transaction: ${error.message}`);
        totalErrors++;
      }
    }
    
    console.log(`   ✓ Saved: ${saved}, Skipped (duplicates): ${skipped}`);
    
    totalTransactions += rows.length;
    totalSaved += saved;
    totalSkipped += skipped;
  }
  
  // Print summary
  console.log(`\n\n📊 Import Summary:`);
  console.log(`   Accounts processed: ${totalAccounts}`);
  console.log(`   Accounts created: ${totalCreated}`);
  console.log(`   Total transactions parsed: ${totalTransactions}`);
  console.log(`   Transactions saved: ${totalSaved}`);
  console.log(`   Transactions skipped (duplicates): ${totalSkipped}`);
  if (totalErrors > 0) {
    console.log(`   Errors: ${totalErrors}`);
  }
  console.log(`\n✅ Import completed!\n`);
}

importTransactions().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
