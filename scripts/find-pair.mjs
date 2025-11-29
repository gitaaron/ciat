#!/usr/bin/env node

import { db } from '../backend/src/db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get search term from command line
const searchTerm = process.argv[2];

if (!searchTerm) {
  console.error('Usage: node find-pair.js <search-term>');
  console.error('Example: node find-pair.js "KAILEICHEN"');
  process.exit(1);
}

// Find the transaction
const tx = db.prepare(`
  SELECT 
    t.id,
    t.date,
    t.name,
    t.description,
    t.amount,
    t.inflow,
    t.category,
    t.category_source,
    t.category_explain,
    t.labels,
    t.hash,
    a.name as account_name
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  WHERE t.name LIKE ?
  LIMIT 1
`).get(`%${searchTerm}%`);

if (!tx) {
  console.log(`❌ Transaction not found matching "${searchTerm}"`);
  process.exit(1);
}

console.log('\n🔍 Found Transaction:');
console.log(`   ID: ${tx.id}`);
console.log(`   Date: ${tx.date}`);
console.log(`   Name: ${tx.name}`);
console.log(`   Amount: $${Math.abs(Number(tx.amount)).toFixed(2)}`);
console.log(`   Type: ${tx.inflow ? '💰 Inflow' : '💸 Outflow'}`);
console.log(`   Account: ${tx.account_name}`);
console.log(`   Category: ${tx.category || 'None'}`);
console.log(`   Category Source: ${tx.category_source || 'None'}`);
console.log(`   Category Explain: ${tx.category_explain || 'None'}`);

// If it's categorized as transfer, find its pair
if (tx.category === 'transfer' && tx.category_source === 'pair_detection') {
  const absAmount = Math.abs(Number(tx.amount));
  const txDate = new Date(tx.date);
  
  console.log(`\n🔗 Looking for pair transaction...`);
  console.log(`   Matching criteria:`);
  console.log(`   - Amount: $${absAmount.toFixed(2)} (opposite flow)`);
  console.log(`   - Date: within 90 days of ${tx.date}`);
  
  // Find potential pairs
  const oppositeFlow = tx.inflow ? 0 : 1;
  
  const potentialPairs = db.prepare(`
    SELECT 
      t.id,
      t.date,
      t.name,
      t.description,
      t.amount,
      t.inflow,
      t.category,
      t.category_source,
      a.name as account_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE t.id != ?
      AND t.inflow = ?
      AND ABS(ABS(t.amount) - ?) <= 0.01
      AND ABS(julianday(t.date) - julianday(?)) <= 90
    ORDER BY ABS(julianday(t.date) - julianday(?))
    LIMIT 5
  `).all(tx.id, oppositeFlow, absAmount, tx.date, tx.date);
  
  if (potentialPairs.length > 0) {
    console.log(`\n✅ Found ${potentialPairs.length} potential pair(s):\n`);
    
    potentialPairs.forEach((pair, index) => {
      const pairDate = new Date(pair.date);
      const daysDiff = Math.abs((pairDate - txDate) / (1000 * 60 * 60 * 24));
      const amountDiff = Math.abs(Math.abs(Number(pair.amount)) - absAmount);
      
      console.log(`   ${index + 1}. ${pair.date} | $${Math.abs(Number(pair.amount)).toFixed(2)} | ${pair.inflow ? '💰 Inflow' : '💸 Outflow'}`);
      console.log(`      ${pair.name}`);
      console.log(`      Account: ${pair.account_name}`);
      console.log(`      Days apart: ${daysDiff.toFixed(1)} days`);
      console.log(`      Amount difference: $${amountDiff.toFixed(2)}`);
      console.log(`      Category: ${pair.category || 'None'} (${pair.category_source || 'None'})`);
      
      if (index === 0 && daysDiff <= 90 && amountDiff <= 0.01) {
        console.log(`      ✅ This is the matched pair!`);
      }
      console.log('');
    });
  } else {
    console.log(`\n⚠️  No potential pairs found. This might be a false positive.`);
  }
  
  // Also check all transactions with same amount
  const sameAmount = db.prepare(`
    SELECT 
      t.id,
      t.date,
      t.name,
      t.amount,
      t.inflow,
      t.category,
      a.name as account_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE ABS(ABS(t.amount) - ?) <= 0.01
      AND t.id != ?
    ORDER BY t.date
    LIMIT 10
  `).all(absAmount, tx.id);
  
  if (sameAmount.length > 0) {
    console.log(`\n📊 Other transactions with same amount ($${absAmount.toFixed(2)}):`);
    sameAmount.forEach((other) => {
      const otherDate = new Date(other.date);
      const daysDiff = Math.abs((otherDate - txDate) / (1000 * 60 * 60 * 24));
      console.log(`   - ${other.date} | ${other.inflow ? '💰' : '💸'} | ${other.name} | ${other.account_name} | ${daysDiff.toFixed(0)} days apart`);
    });
  }
} else {
  console.log(`\nℹ️  This transaction is not categorized as 'transfer' by pair detection.`);
  console.log(`   Current category: ${tx.category || 'None'}`);
  console.log(`   Category source: ${tx.category_source || 'None'}`);
}

// Database connection is managed by the module

