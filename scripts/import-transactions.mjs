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
import { parseLabels, applyRulesToTransactions } from '../common/src/ruleMatcher.js';
import { Rules, AutogenRules } from '../backend/src/models.js';
import { loadSystemRules } from '../backend/src/utils/systemRules.js';
import { loadManualOverrides } from '../backend/src/utils/manualOverrides.js';

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
    "useCutoffDate": false,
    "accounts": [
      {
        "name": "Account Name",
        "file": "path/to/transactions.csv",
        "type": "bank_account",
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
  
Account Type:
  - Optional field: "type" can be "bank_account" or "credit_card"
  - Defaults to "bank_account" if not specified

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

Configuration Options:
  - useCutoffDate: (optional, default: false) If true, scans all files to find the
    latest (newest) earliest date across all files, and excludes transactions before
    that date. This prevents importing old historical data when adding new accounts.

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
  
  // Validate account type if provided
  if (account.type && !['bank_account', 'credit_card'].includes(account.type)) {
    console.error(`❌ Error: Invalid account type "${account.type}" for account "${account.name}". Must be "bank_account" or "credit_card"`);
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

/**
 * Detect pair transactions and categorize them as 'transfer'
 * Pair transactions are defined as:
 * - Equal amount (one outflow, one inflow)
 * - Could be same account or different accounts
 * - Within 3 months of each other
 * This takes highest precedence and overrides any existing category
 */
function detectAndCategorizePairTransactions() {
  // Get all transactions ordered by date
  const allTransactions = db.prepare(`
    SELECT id, account_id, date, amount, inflow, category, hash, name
    FROM transactions
    ORDER BY date ASC, amount ASC
  `).all();
  
  if (allTransactions.length < 2) {
    return { pairsFound: 0, updated: 0 };
  }
  
  // Group transactions by absolute amount (with small tolerance for floating point precision)
  // Use rounded amounts to group (round to 2 decimal places for currency)
  const transactionsByAmount = new Map();
  for (const tx of allTransactions) {
    const absAmount = Math.abs(Number(tx.amount));
    // Round to 2 decimal places to handle floating point precision issues
    const roundedAmount = Math.round(absAmount * 100) / 100;
    if (!transactionsByAmount.has(roundedAmount)) {
      transactionsByAmount.set(roundedAmount, []);
    }
    transactionsByAmount.get(roundedAmount).push(tx);
  }
  
  const pairsFound = [];
  const updatedIds = new Set();
  
  // For each amount, find pairs
  for (const [amount, transactions] of transactionsByAmount.entries()) {
    // Separate inflows and outflows
    const inflows = transactions.filter(tx => tx.inflow === 1);
    const outflows = transactions.filter(tx => tx.inflow === 0);
    
    // Try to match each outflow with an inflow
    for (const outflow of outflows) {
      if (updatedIds.has(outflow.id)) continue; // Already paired
      
      const outflowDate = new Date(outflow.date);
      const outflowAmount = Math.abs(Number(outflow.amount));
      
      // Find matching inflow within 3 months
      for (const inflow of inflows) {
        if (updatedIds.has(inflow.id)) continue; // Already paired
        
        const inflowDate = new Date(inflow.date);
        const inflowAmount = Math.abs(Number(inflow.amount));
        
        // Check if amounts match (within small tolerance for floating point precision)
        const amountDiff = Math.abs(outflowAmount - inflowAmount);
        if (amountDiff > 0.01) continue; // Amounts don't match (tolerance: 1 cent)
        
        // Calculate time difference in days
        const timeDiffMs = Math.abs(inflowDate - outflowDate);
        const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);
        
        // 3 months = 90 days (approximately)
        const threeMonthsDays = 90;
        
        if (timeDiffDays <= threeMonthsDays) {
          // Found a pair!
          pairsFound.push({ outflow, inflow });
          updatedIds.add(outflow.id);
          updatedIds.add(inflow.id);
          break; // Each transaction can only be in one pair
        }
      }
    }
  }
  
  // Update all paired transactions to 'transfer' category
  // This takes highest precedence, so we override any existing category
  const updateStmt = db.prepare(`
    UPDATE transactions 
    SET category=?, category_source=?, category_explain=?, updated_at=CURRENT_TIMESTAMP 
    WHERE id=?
  `);
  
  let updated = 0;
  for (const pair of pairsFound) {
    // Update outflow
    const result1 = updateStmt.run('transfer', 'pair_detection', 'Pair transaction detected (equal amount, opposite flow, within 3 months)', pair.outflow.id);
    if (result1.changes > 0) updated++;
    
    // Update inflow
    const result2 = updateStmt.run('transfer', 'pair_detection', 'Pair transaction detected (equal amount, opposite flow, within 3 months)', pair.inflow.id);
    if (result2.changes > 0) updated++;
  }
  
  return { pairsFound: pairsFound.length, updated, pairs: pairsFound };
}

/**
 * Find the earliest date in a parsed transaction array
 * Returns null if no valid dates found
 */
function findEarliestDate(transactions) {
  if (!transactions || transactions.length === 0) {
    return null;
  }
  
  let earliestDate = null;
  for (const tx of transactions) {
    if (tx.date) {
      const dateStr = tx.date.toString().slice(0, 10); // Ensure YYYY-MM-DD format
      if (!earliestDate || dateStr < earliestDate) {
        earliestDate = dateStr;
      }
    }
  }
  
  return earliestDate;
}

/**
 * Scan all files to find the latest (newest) earliest date
 * This will be used as the cutoff date for imports
 */
async function findCutoffDate() {
  console.log('🔍 Scanning files to determine cutoff date...\n');
  
  const earliestDates = [];
  
  for (const accountConfig of config.accounts) {
    const filePath = accountConfig.file;
    const resolvedPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(configDir, filePath);
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      console.log(`   ⚠️  Skipping missing file: ${resolvedPath}`);
      continue;
    }
    
    try {
      // Read file
      const fileBuffer = fs.readFileSync(resolvedPath);
      const fileName = path.basename(resolvedPath);
      
      // Detect file format
      const format = detectFileFormat(fileName, fileBuffer);
      
      if (!isSupportedFormat(format)) {
        console.log(`   ⚠️  Skipping unsupported format: ${format} (${resolvedPath})`);
        continue;
      }
      
      // Parse transactions to find earliest date
      let rows;
      if (format === 'csv') {
        // Get account if it exists to use its field mapping
        const account = Accounts.findByName(accountConfig.name);
        const fieldMapping = accountConfig.fieldMapping || (account?.field_mapping) || null;
        rows = parseTransactionsCSV(fileBuffer, fieldMapping);
      } else if (format === 'qfx') {
        rows = await parseTransactionsQFX(fileBuffer);
      }
      
      if (rows && rows.length > 0) {
        const earliestDate = findEarliestDate(rows);
        if (earliestDate) {
          earliestDates.push({
            file: resolvedPath,
            account: accountConfig.name,
            earliestDate
          });
          console.log(`   📅 ${accountConfig.name}: earliest date ${earliestDate}`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Error scanning file ${resolvedPath}: ${error.message}`);
    }
  }
  
  if (earliestDates.length === 0) {
    console.log('   ⚠️  No valid dates found in any files. No cutoff will be applied.\n');
    return null;
  }
  
  // Find the latest (newest) of all earliest dates
  const cutoffDate = earliestDates.reduce((latest, item) => {
    return item.earliestDate > latest ? item.earliestDate : latest;
  }, earliestDates[0].earliestDate);
  
  console.log(`\n   ✂️  Cutoff date determined: ${cutoffDate}`);
  console.log(`   (Transactions before this date will be excluded)\n`);
  
  return cutoffDate;
}

async function importTransactions() {
  console.log('\n📥 Starting transaction import...\n');
  
  // Check if cutoff date feature is enabled
  const useCutoffDate = config.useCutoffDate === true;
  
  // First, determine the cutoff date by scanning all files (if enabled)
  let cutoffDate = null;
  if (useCutoffDate) {
    cutoffDate = await findCutoffDate();
  } else {
    console.log('ℹ️  Cutoff date feature is disabled (useCutoffDate: false)\n');
  }
  
  let totalAccounts = 0;
  let totalCreated = 0;
  let totalTransactions = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalFilteredByCutoff = 0;
  
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
    // Default to 'bank_account' if type not specified
    const accountType = accountConfig.type || 'bank_account';
    
    if (!account) {
      console.log(`   ➕ Creating account: ${accountName} (type: ${accountType})`);
      Accounts.create(accountName, accountType);
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
      
      // Update account type if:
      // 1. Account has no type (set to default 'bank_account' or config type)
      // 2. Config specifies a type that differs from existing type
      if (!account.type) {
        console.log(`   🔄 Setting account type to: ${accountType} (was unset)`);
        Accounts.update(account.id, accountName, accountType);
        account = Accounts.findByName(accountName); // Refresh to get updated account
      } else if (accountConfig.type && account.type !== accountConfig.type) {
        console.log(`   🔄 Updating account type from ${account.type} to: ${accountType}`);
        Accounts.update(account.id, accountName, accountType);
        account = Accounts.findByName(accountName); // Refresh to get updated account
      }
      
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
    let filteredByCutoff = 0;
    
    // Prepare transactions for rule application
    const transactionsToCategorize = [];
    
    for (const row of rows) {
      try {
        // Apply cutoff date filter if one was determined
        if (cutoffDate) {
          const txDate = row.date ? row.date.toString().slice(0, 10) : null;
          if (txDate && txDate < cutoffDate) {
            filteredByCutoff++;
            continue;
          }
        }
        
        // Normalize fields for hash computation (must match how hash was originally computed)
        // Convert empty string to null for description to ensure hash consistency
        // Use account_name instead of account_id for stable hashing across DB recreations
        const hashData = {
          external_id: row.external_id || null,
          account_name: account.name,
          date: row.date,
          name: row.name,
          description: (row.description && row.description.trim()) || null, // Normalize empty string to null
          amount: Number(row.amount),
          inflow: row.inflow ? 1 : 0
        };
        const hash = txHash(hashData);
        
        // Check if transaction already exists
        const existing = db.prepare('SELECT id FROM transactions WHERE hash=?').get(hash);
        if (existing) {
          skipped++;
          continue;
        }
        
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
          category: null, // Will be set by rules
          category_source: null,
          category_explain: null,
          labels: labels.length > 0 ? JSON.stringify(labels) : null,
          note: null,
          hash: hash,
        };
        
        transactionsToCategorize.push(tx);
      } catch (error) {
        console.error(`   ⚠️  Error processing transaction: ${error.message}`);
        totalErrors++;
      }
    }
    
    if (filteredByCutoff > 0) {
      console.log(`   ✂️  Filtered ${filteredByCutoff} transactions before cutoff date (${cutoffDate})`);
    }
    
    // Apply system rules, user rules, and autogen rules to transactions
    if (transactionsToCategorize.length > 0) {
      console.log(`   🔍 Applying rules to ${transactionsToCategorize.length} transactions...`);
      
      // Get all enabled rules (user, autogen, and system)
      const userRules = Rules.findEnabled();
      const autogenRules = AutogenRules.findEnabled();
      const systemRulesList = loadSystemRules();
      
      // Log rule counts for visibility
      console.log(`   📋 Rules: ${userRules.length} user, ${autogenRules.length} autogen, ${systemRulesList.length} system`);
      
      // Fetch all accounts and create a map for quick lookup (needed for account type filtering)
      const allAccounts = Accounts.all();
      const accountsMap = {};
      for (const acc of allAccounts) {
        accountsMap[acc.id] = acc;
      }
      
      // Load manual overrides from flat file (highest priority)
      const manualOverrides = loadManualOverrides();
      const overrideCount = Object.keys(manualOverrides || {}).length;
      if (overrideCount > 0) {
        console.log(`   📝 Loaded ${overrideCount} manual override(s) from flat file`);
        
        // Debug: Check if any transaction hashes match the manual overrides
        const transactionHashes = new Set(transactionsToCategorize.map(tx => tx.hash));
        const overrideHashes = new Set(Object.keys(manualOverrides));
        const matchingHashes = [...transactionHashes].filter(hash => overrideHashes.has(hash));
        
        if (matchingHashes.length > 0) {
          console.log(`   🔍 Found ${matchingHashes.length} transaction hash(es) that match manual overrides`);
        } else {
          console.log(`   ⚠️  WARNING: No transaction hashes match the manual override hashes!`);
          console.log(`   🔍 Sample transaction hashes (first 3):`, transactionsToCategorize.slice(0, 3).map(tx => tx.hash));
          console.log(`   🔍 Sample override hashes (first 3):`, Object.keys(manualOverrides).slice(0, 3));
        }
      }
      
      // Combine all rules in priority order
      const allRules = [...userRules, ...autogenRules, ...systemRulesList];
      
      // Apply rules to transactions with account information and manual overrides
      const categorizedTransactions = applyRulesToTransactions(transactionsToCategorize, allRules, { 
        accounts: accountsMap,
        manualOverrides: manualOverrides
      });
      
      // Count how many transactions were categorized by manual overrides
      const manualOverrideMatches = categorizedTransactions.filter(tx => tx.category_source === 'manual').length;
      if (manualOverrideMatches > 0) {
        console.log(`   ✅ Applied ${manualOverrideMatches} manual override(s)`);
      } else if (overrideCount > 0) {
        console.log(`   ⚠️  WARNING: Manual overrides were loaded but none were applied!`);
      }
      
      // Save categorized transactions
      for (const tx of categorizedTransactions) {
        try {
          const labelsJson = tx.labels && Array.isArray(tx.labels) 
            ? JSON.stringify(tx.labels) 
            : (tx.labels || null);
          
          const txToSave = {
            ...tx,
            labels: labelsJson,
            category_source: tx.category_source || 'none',
            category_explain: tx.category_explain || 'No match'
          };
          
          const result = Transactions.upsert(txToSave);
          if (result.skipped) {
            skipped++;
          } else {
            saved++;
          }
        } catch (error) {
          console.error(`   ⚠️  Error saving transaction: ${error.message}`);
          totalErrors++;
        }
      }
    }
    
    console.log(`   ✓ Saved: ${saved}, Skipped (duplicates): ${skipped}`);
    
    totalTransactions += rows.length;
    totalSaved += saved;
    totalSkipped += skipped;
    totalFilteredByCutoff += filteredByCutoff;
  }
  
  // After importing, update existing transactions that have manual overrides
  console.log(`\n🔄 Checking existing transactions for manual overrides...`);
  const manualOverrides = loadManualOverrides();
  const overrideHashes = Object.keys(manualOverrides || {});
  
  if (overrideHashes.length > 0) {
    let updatedExisting = 0;
    const updateStmt = db.prepare(`
      UPDATE transactions 
      SET category=?, category_source=?, category_explain=?, updated_at=CURRENT_TIMESTAMP 
      WHERE hash=? AND (category IS NULL OR category != ? OR category_source IS NULL OR category_source != 'manual')
    `);
    
    for (const hash of overrideHashes) {
      const category = manualOverrides[hash];
      const result = updateStmt.run(category, 'manual', 'Manual override (flat file)', hash, category);
      if (result.changes > 0) {
        updatedExisting += result.changes;
      }
    }
    
    if (updatedExisting > 0) {
      console.log(`   ✅ Updated ${updatedExisting} existing transaction(s) with manual overrides`);
    } else {
      console.log(`   ℹ️  No existing transactions needed updates (already categorized correctly)`);
    }
  } else {
    console.log(`   ℹ️  No manual overrides found in flat file`);
  }
  
  // Final step: Detect and categorize pair transactions (highest precedence)
  console.log(`\n🔍 Detecting pair transactions (transfer pairs)...`);
  const pairDetectionResult = detectAndCategorizePairTransactions();
  if (pairDetectionResult.pairsFound > 0) {
    console.log(`   ✅ Found ${pairDetectionResult.pairsFound} pair(s) and updated ${pairDetectionResult.updated} transaction(s) to 'transfer' category`);
    if (pairDetectionResult.pairs && pairDetectionResult.pairs.length > 0) {
      console.log(`\n   📋 Paired transactions:`);
      pairDetectionResult.pairs.forEach((pair, index) => {
        const daysDiff = Math.abs((new Date(pair.inflow.date) - new Date(pair.outflow.date)) / (1000 * 60 * 60 * 24));
        const sameAccount = pair.outflow.account_id === pair.inflow.account_id;
        console.log(`   ${index + 1}. ${pair.outflow.date} → ${pair.inflow.date} (${daysDiff.toFixed(0)} days apart, ${sameAccount ? 'same account' : 'different accounts'})`);
        console.log(`      Outflow: $${Math.abs(Number(pair.outflow.amount)).toFixed(2)} - ${pair.outflow.name || 'N/A'}`);
        console.log(`      Inflow:  $${Math.abs(Number(pair.inflow.amount)).toFixed(2)} - ${pair.inflow.name || 'N/A'}`);
      });
    }
  } else {
    console.log(`   ℹ️  No pair transactions found`);
  }
  
  // Print summary
  console.log(`\n\n📊 Import Summary:`);
  console.log(`   Accounts processed: ${totalAccounts}`);
  console.log(`   Accounts created: ${totalCreated}`);
  console.log(`   Total transactions parsed: ${totalTransactions}`);
  if (cutoffDate) {
    console.log(`   Transactions filtered (before ${cutoffDate}): ${totalFilteredByCutoff}`);
  }
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
