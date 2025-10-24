#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Connect to database
const dbPath = path.join(__dirname, '..', 'backend', 'data', 'ciat.sqlite');
const db = new Database(dbPath);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  format: 'csv',
  output: null,
  startDate: null,
  endDate: null,
  category: null,
  account: null,
  includeLabels: true,
  includeNotes: true,
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--format':
    case '-f':
      options.format = args[++i].toLowerCase();
      break;
    case '--output':
    case '-o':
      options.output = args[++i];
      break;
    case '--start':
    case '-s':
      options.startDate = args[++i];
      break;
    case '--end':
    case '-e':
      options.endDate = args[++i];
      break;
    case '--category':
    case '-c':
      options.category = args[++i];
      break;
    case '--account':
    case '-a':
      options.account = args[++i];
      break;
    case '--no-labels':
      options.includeLabels = false;
      break;
    case '--no-notes':
      options.includeNotes = false;
      break;
    case '--help':
    case '-h':
      options.help = true;
      break;
  }
}

if (options.help) {
  console.log(`
Usage: node export-data.js [options]

Options:
  -f, --format <format>       Export format: csv, json, xlsx (default: csv)
  -o, --output <file>         Output file path
  -s, --start <date>          Start date (YYYY-MM-DD)
  -e, --end <date>            End date (YYYY-MM-DD)
  -c, --category <category>   Filter by category
  -a, --account <account>     Filter by account name
  --no-labels                 Exclude labels from export
  --no-notes                  Exclude notes from export
  -h, --help                  Show this help message

Examples:
  node export-data.js --format csv --output transactions.csv
  node export-data.js --format json --start 2024-01-01 --end 2024-12-31
  node export-data.js --format xlsx --category "Food" --output food-transactions.xlsx
`);
  process.exit(0);
}

// Validate format
const validFormats = ['csv', 'json', 'xlsx'];
if (!validFormats.includes(options.format)) {
  console.error(`❌ Invalid format: ${options.format}. Valid formats: ${validFormats.join(', ')}`);
  process.exit(1);
}

// Generate output filename if not provided
if (!options.output) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  options.output = `ciat-export-${timestamp}.${options.format}`;
}

// Build query
let sql = `
  SELECT 
    t.id,
    t.external_id,
    t.date,
    t.name,
    t.description,
    t.amount,
    t.inflow,
    t.category,
    t.category_source,
    t.category_explain,
    t.labels,
    t.note,
    t.hash,
    t.created_at,
    t.updated_at,
    t.manual_override,
    a.name as account_name
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  WHERE 1=1
`;

const params = {};

if (options.startDate) {
  sql += ' AND date(t.date) >= date(@startDate)';
  params.startDate = options.startDate;
}

if (options.endDate) {
  sql += ' AND date(t.date) <= date(@endDate)';
  params.endDate = options.endDate;
}

if (options.category) {
  sql += ' AND t.category = @category';
  params.category = options.category;
}

if (options.account) {
  sql += ' AND a.name LIKE @account';
  params.account = `%${options.account}%`;
}

sql += ' ORDER BY t.date DESC, t.id DESC';

// Execute query
const transactions = db.prepare(sql).all(params);

console.log(`📊 Exporting ${transactions.length} transactions to ${options.output}...`);

// Export based on format
switch (options.format) {
  case 'csv':
    exportCSV(transactions, options);
    break;
  case 'json':
    exportJSON(transactions, options);
    break;
  case 'xlsx':
    exportXLSX(transactions, options);
    break;
}

function exportCSV(transactions, options) {
  const headers = [
    'ID',
    'External ID',
    'Date',
    'Name',
    'Description',
    'Amount',
    'Type',
    'Category',
    'Category Source',
    'Category Explain',
    'Account',
    'Hash',
    'Created At',
    'Updated At',
    'Manual Override'
  ];

  if (options.includeLabels) {
    headers.splice(headers.indexOf('Category Explain'), 0, 'Labels');
  }
  if (options.includeNotes) {
    headers.splice(headers.indexOf('Category Explain'), 0, 'Note');
  }

  let csv = headers.join(',') + '\n';

  transactions.forEach(tx => {
    const row = [
      tx.id,
      tx.external_id || '',
      tx.date,
      `"${tx.name.replace(/"/g, '""')}"`,
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      tx.amount,
      tx.inflow ? 'Income' : 'Expense',
      tx.category || '',
      tx.category_source || '',
      tx.category_explain || '',
      tx.account_name,
      tx.hash,
      tx.created_at,
      tx.updated_at,
      tx.manual_override ? 'Yes' : 'No'
    ];

    if (options.includeLabels) {
      const labels = tx.labels ? JSON.parse(tx.labels).join('; ') : '';
      row.splice(row.indexOf(tx.category_explain || ''), 0, `"${labels}"`);
    }
    if (options.includeNotes) {
      row.splice(row.indexOf(tx.category_explain || ''), 0, `"${(tx.note || '').replace(/"/g, '""')}"`);
    }

    csv += row.join(',') + '\n';
  });

  fs.writeFileSync(options.output, csv);
  console.log(`✅ CSV export completed: ${options.output}`);
}

function exportJSON(transactions, options) {
  const exportData = {
    export_info: {
      timestamp: new Date().toISOString(),
      total_transactions: transactions.length,
      filters: {
        start_date: options.startDate,
        end_date: options.endDate,
        category: options.category,
        account: options.account
      }
    },
    transactions: transactions.map(tx => ({
      id: tx.id,
      external_id: tx.external_id,
      date: tx.date,
      name: tx.name,
      description: tx.description,
      amount: parseFloat(tx.amount),
      inflow: tx.inflow === 1,
      category: tx.category,
      category_source: tx.category_source,
      category_explain: tx.category_explain,
      labels: tx.labels ? JSON.parse(tx.labels) : [],
      note: tx.note,
      account_name: tx.account_name,
      hash: tx.hash,
      created_at: tx.created_at,
      updated_at: tx.updated_at,
      manual_override: tx.manual_override === 1
    }))
  };

  fs.writeFileSync(options.output, JSON.stringify(exportData, null, 2));
  console.log(`✅ JSON export completed: ${options.output}`);
}

function exportXLSX(transactions, options) {
  try {
    // Try to import xlsx module
    const XLSX = require('xlsx');
    
    const worksheetData = transactions.map(tx => {
      const row = {
        'ID': tx.id,
        'External ID': tx.external_id || '',
        'Date': tx.date,
        'Name': tx.name,
        'Description': tx.description || '',
        'Amount': parseFloat(tx.amount),
        'Type': tx.inflow ? 'Income' : 'Expense',
        'Category': tx.category || '',
        'Category Source': tx.category_source || '',
        'Category Explain': tx.category_explain || '',
        'Account': tx.account_name,
        'Hash': tx.hash,
        'Created At': tx.created_at,
        'Updated At': tx.updated_at,
        'Manual Override': tx.manual_override ? 'Yes' : 'No'
      };

      if (options.includeLabels) {
        row['Labels'] = tx.labels ? JSON.parse(tx.labels).join('; ') : '';
      }
      if (options.includeNotes) {
        row['Note'] = tx.note || '';
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
    
    XLSX.writeFile(workbook, options.output);
    console.log(`✅ XLSX export completed: ${options.output}`);
  } catch (error) {
    console.error('❌ XLSX export failed. Make sure to install xlsx package:');
    console.error('   npm install xlsx');
    console.error('   Or use CSV format instead.');
    process.exit(1);
  }
}

// Show export summary
const totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
const incomeCount = transactions.filter(tx => tx.inflow).length;
const expenseCount = transactions.filter(tx => !tx.inflow).length;

console.log('\n📊 Export Summary:');
console.log(`   File: ${options.output}`);
console.log(`   Format: ${options.format.toUpperCase()}`);
console.log(`   Transactions: ${transactions.length.toLocaleString()}`);
console.log(`   Total Amount: $${totalAmount.toFixed(2)}`);
console.log(`   Income: ${incomeCount} transactions`);
console.log(`   Expenses: ${expenseCount} transactions`);

if (options.startDate || options.endDate) {
  console.log(`   Date Range: ${options.startDate || 'beginning'} to ${options.endDate || 'end'}`);
}

if (options.category) {
  console.log(`   Category Filter: ${options.category}`);
}

if (options.account) {
  console.log(`   Account Filter: ${options.account}`);
}

db.close();
