#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'backend', 'data', 'ciat.sqlite');
const db = new Database(dbPath);

console.log('⚡ CIAT Quick Summary\n');

// Basic stats
const totalTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
const totalAccounts = db.prepare('SELECT COUNT(*) as count FROM accounts').get();
const uncategorizedCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE category IS NULL OR category = \'\'').get();

console.log('📊 Overview:');
console.log(`   Transactions: ${totalTransactions.count.toLocaleString()}`);
console.log(`   Accounts: ${totalAccounts.count}`);
console.log(`   Uncategorized: ${uncategorizedCount.count.toLocaleString()}`);

// Date range
const dateRange = db.prepare(`
  SELECT 
    MIN(date) as earliest,
    MAX(date) as latest
  FROM transactions
`).get();

if (dateRange.earliest) {
  console.log(`   Date Range: ${dateRange.earliest} to ${dateRange.latest}`);
}

// Financial summary
const financial = db.prepare(`
  SELECT 
    COALESCE(SUM(amount), 0) as total,
    COALESCE(SUM(CASE WHEN inflow = 1 THEN amount ELSE 0 END), 0) as income,
    COALESCE(SUM(CASE WHEN inflow = 0 THEN amount ELSE 0 END), 0) as expenses,
    COALESCE(COUNT(CASE WHEN inflow = 1 THEN 1 END), 0) as income_count,
    COALESCE(COUNT(CASE WHEN inflow = 0 THEN 1 END), 0) as expense_count
  FROM transactions
`).get();

console.log('\n💰 Financial:');
console.log(`   Total: $${financial.total.toFixed(2)}`);
console.log(`   Income: $${financial.income.toFixed(2)} (${financial.income_count.toLocaleString()} transactions)`);
console.log(`   Expenses: $${financial.expenses.toFixed(2)} (${financial.expense_count.toLocaleString()} transactions)`);

// Top categories
console.log('\n🏷️  Top Categories:');
const topCategories = db.prepare(`
  SELECT 
    COALESCE(category, 'Uncategorized') as category,
    COUNT(*) as count,
    SUM(amount) as total
  FROM transactions
  GROUP BY category
  ORDER BY count DESC
  LIMIT 5
`).all();

topCategories.forEach((cat, index) => {
  console.log(`   ${index + 1}. ${cat.category}: ${cat.count.toLocaleString()} transactions ($${cat.total.toFixed(2)})`);
});

// Recent activity
console.log('\n🕒 Recent Activity:');
const recent = db.prepare(`
  SELECT 
    date,
    name,
    amount,
    inflow,
    category
  FROM transactions
  ORDER BY date DESC
  LIMIT 5
`).all();

recent.forEach((tx, index) => {
  const amount = parseFloat(tx.amount);
  const amountStr = amount >= 0 ? `+$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`;
  const type = tx.inflow ? '💰' : '💸';
  const category = tx.category || '❓';
  console.log(`   ${index + 1}. ${tx.date} | ${amountStr} | ${type} ${tx.name} (${category})`);
});

// Monthly breakdown (last 3 months)
console.log('\n📅 Last 3 Months:');
const monthly = db.prepare(`
  SELECT 
    strftime('%Y-%m', date) as month,
    COUNT(*) as count,
    SUM(amount) as total,
    SUM(CASE WHEN inflow = 1 THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN inflow = 0 THEN amount ELSE 0 END) as expenses
  FROM transactions
  WHERE date >= date('now', '-3 months')
  GROUP BY strftime('%Y-%m', date)
  ORDER BY month DESC
`).all();

monthly.forEach(month => {
  console.log(`   ${month.month}: ${month.count.toLocaleString()} transactions, $${month.total.toFixed(2)} (Income: $${month.income.toFixed(2)}, Expenses: $${month.expenses.toFixed(2)})`);
});

db.close();
