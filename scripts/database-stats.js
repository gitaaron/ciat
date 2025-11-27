#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'backend', 'data', 'ciat.sqlite');
const db = new Database(dbPath);

console.log('📊 CIAT Database Statistics\n');

// Basic counts
const totalTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
const totalAccounts = db.prepare('SELECT COUNT(*) as count FROM accounts').get();
const uncategorizedCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE category IS NULL OR category = \'\' OR category = \'uncategorized\'').get();

// Load manual overrides from flat file
let manualOverrideCount = 0;
try {
  // Use dynamic import for ES module
  const manualOverridesModule = await import('../backend/src/utils/manualOverrides.js');
  const overrides = manualOverridesModule.loadManualOverrides();
  manualOverrideCount = Object.keys(overrides).length;
} catch (e) {
  console.log('   Note: Could not load manual overrides count from flat file');
}

console.log('📈 Basic Statistics:');
console.log(`   Total Transactions: ${totalTransactions.count.toLocaleString()}`);
console.log(`   Total Accounts: ${totalAccounts.count}`);
console.log(`   Uncategorized: ${uncategorizedCount.count.toLocaleString()}`);
console.log(`   Manual Overrides (flat file): ${manualOverrideCount.toLocaleString()}`);

// Date range
const dateRange = db.prepare(`
  SELECT 
    MIN(date) as earliest,
    MAX(date) as latest,
    COUNT(DISTINCT date) as unique_days
  FROM transactions
`).get();

if (dateRange.earliest) {
  console.log(`\n📅 Date Range:`);
  console.log(`   Earliest: ${dateRange.earliest}`);
  console.log(`   Latest: ${dateRange.latest}`);
  console.log(`   Unique Days: ${dateRange.unique_days}`);
}

// Amount statistics
const amountStats = db.prepare(`
  SELECT 
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    MIN(amount) as min_amount,
    MAX(amount) as max_amount,
    COUNT(CASE WHEN inflow = 1 THEN 1 END) as income_count,
    COUNT(CASE WHEN inflow = 0 THEN 1 END) as expense_count,
    SUM(CASE WHEN inflow = 1 THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN inflow = 0 THEN amount ELSE 0 END) as total_expenses
  FROM transactions
`).get();

console.log(`\n💰 Financial Summary:`);
console.log(`   Total Amount: $${amountStats.total_amount?.toFixed(2) || '0.00'}`);
console.log(`   Average Transaction: $${amountStats.avg_amount?.toFixed(2) || '0.00'}`);
console.log(`   Largest Transaction: $${amountStats.max_amount?.toFixed(2) || '0.00'}`);
console.log(`   Smallest Transaction: $${amountStats.min_amount?.toFixed(2) || '0.00'}`);
console.log(`   Income Transactions: ${amountStats.income_count?.toLocaleString() || '0'}`);
console.log(`   Expense Transactions: ${amountStats.expense_count?.toLocaleString() || '0'}`);
console.log(`   Total Income: $${amountStats.total_income?.toFixed(2) || '0.00'}`);
console.log(`   Total Expenses: $${amountStats.total_expenses?.toFixed(2) || '0.00'}`);

// Account breakdown
console.log(`\n🏦 Account Breakdown:`);
const accountStats = db.prepare(`
  SELECT 
    a.name,
    COUNT(t.id) as transaction_count,
    SUM(t.amount) as total_amount,
    AVG(t.amount) as avg_amount
  FROM accounts a
  LEFT JOIN transactions t ON a.id = t.account_id
  GROUP BY a.id, a.name
  ORDER BY transaction_count DESC
`).all();

accountStats.forEach(account => {
  console.log(`   ${account.name}:`);
  console.log(`     Transactions: ${account.transaction_count?.toLocaleString() || '0'}`);
  console.log(`     Total: $${account.total_amount?.toFixed(2) || '0.00'}`);
  console.log(`     Average: $${account.avg_amount?.toFixed(2) || '0.00'}`);
});

// Category breakdown
console.log(`\n🏷️  Category Breakdown:`);
const categoryStats = db.prepare(`
  SELECT 
    COALESCE(category, 'Uncategorized') as category,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    category_source
  FROM transactions
  GROUP BY category, category_source
  ORDER BY count DESC
  LIMIT 20
`).all();

categoryStats.forEach(cat => {
  console.log(`   ${cat.category} (${cat.category_source || 'unknown'}):`);
  console.log(`     Count: ${cat.count.toLocaleString()}`);
  console.log(`     Total: $${cat.total_amount?.toFixed(2) || '0.00'}`);
  console.log(`     Average: $${cat.avg_amount?.toFixed(2) || '0.00'}`);
});

// Monthly breakdown
console.log(`\n📅 Monthly Breakdown (Last 12 months):`);
const monthlyStats = db.prepare(`
  SELECT 
    strftime('%Y-%m', date) as month,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    SUM(CASE WHEN inflow = 1 THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN inflow = 0 THEN amount ELSE 0 END) as expenses
  FROM transactions
  WHERE date >= date('now', '-12 months')
  GROUP BY strftime('%Y-%m', date)
  ORDER BY month DESC
`).all();

monthlyStats.forEach(month => {
  console.log(`   ${month.month}:`);
  console.log(`     Transactions: ${month.transaction_count.toLocaleString()}`);
  console.log(`     Total: $${month.total_amount?.toFixed(2) || '0.00'}`);
  console.log(`     Income: $${month.income?.toFixed(2) || '0.00'}`);
  console.log(`     Expenses: $${month.expenses?.toFixed(2) || '0.00'}`);
});

// Labels analysis
console.log(`\n🏷️  Labels Analysis:`);
const labelStats = db.prepare(`
  SELECT 
    labels,
    COUNT(*) as count
  FROM transactions
  WHERE labels IS NOT NULL AND labels != 'null' AND labels != '[]'
  GROUP BY labels
  ORDER BY count DESC
  LIMIT 10
`).all();

if (labelStats.length > 0) {
  labelStats.forEach(label => {
    const labels = JSON.parse(label.labels);
    console.log(`   ${labels.join(', ')}: ${label.count.toLocaleString()} transactions`);
  });
} else {
  console.log('   No labels found');
}

// Recent activity
console.log(`\n🕒 Recent Activity (Last 10 transactions):`);
const recentTransactions = db.prepare(`
  SELECT 
    t.date,
    t.name,
    t.amount,
    t.inflow,
    t.category,
    a.name as account_name
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  ORDER BY t.date DESC, t.id DESC
  LIMIT 10
`).all();

recentTransactions.forEach((tx, index) => {
  const amount = parseFloat(tx.amount);
  const amountStr = amount >= 0 ? `+$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`;
  const type = tx.inflow ? '💰' : '💸';
  console.log(`   ${index + 1}. ${tx.date} | ${amountStr} | ${type} ${tx.name} (${tx.category || 'Uncategorized'})`);
});

// Database size
const dbSize = db.prepare('PRAGMA page_count').get();
const pageSize = db.prepare('PRAGMA page_size').get();
const dbSizeMB = (dbSize.page_count * pageSize.page_size) / (1024 * 1024);

console.log(`\n💾 Database Info:`);
console.log(`   Size: ${dbSizeMB.toFixed(2)} MB`);
console.log(`   Pages: ${dbSize.page_count.toLocaleString()}`);

db.close();
