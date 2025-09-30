
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadJSON(name) {
  const p = path.join(__dirname, name);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveJSON(name, data) {
  const p = path.join(__dirname, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function normalize(s='') {
  return s.toUpperCase().replace(/\s+/g,' ').trim();
}

export function guessCategory(tx) {
  const rules = loadJSON('rules.json').filter(r => r.enabled !== false).sort((a,b) => {
    // First sort by priority (highest first)
    if (b.priority !== a.priority) return b.priority - a.priority;
    // If same priority, most recent wins (by created_at or updated_at)
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
  const patterns = loadJSON('patterns.json').filter(r => r.enabled !== false).sort((a,b)=>b.priority-a.priority);

  const merchant = normalize(tx.name || '');
  const description = normalize(tx.description || '');
  const merchant_normalized = merchant;
  const description_normalized = description;

  // 1) Rules (user-first precedence)
  for (const r of rules) {
    if (matches(r, { merchant_normalized, description_normalized })) {
      return { category: r.category, source: 'rule', explain: r.explain || 'User rule match' };
    }
  }
  // 2) Pattern matching
  for (const r of patterns) {
    if (matches(r, { merchant_normalized, description_normalized })) {
      return { category: r.category, source: 'pattern', explain: r.explain || 'Pattern match' };
    }
  }
  // 3) ML (stub)
  const ml = mlGuess(tx);
  if (ml) return ml;
  return { category: null, source: 'none', explain: 'No match' };
}

function matches(rule, ctx) {
  const p = rule.pattern || '';
  switch (rule.match_type) {
    case 'exact':
      return ctx.merchant_normalized === p || ctx.description_normalized === p;
    case 'contains':
      return ctx.merchant_normalized.includes(p) || ctx.description_normalized.includes(p);
    case 'regex':
      try { return new RegExp(p, 'i').test(ctx.merchant_normalized) || new RegExp(p, 'i').test(ctx.description_normalized); }
      catch { return false; }
    default:
      return false;
  }
}

function mlGuess(tx) {
  const m = normalize(tx.name || tx.description || '');
  const amount = Math.abs(Number(tx.amount || 0));
  
  // Fixed costs patterns
  const fixedCostsPatterns = [
    'RENT', 'MORTGAGE', 'UTILITY', 'ELECTRIC', 'GAS', 'WATER', 'SEWER', 'TRASH',
    'INSURANCE', 'CAR INSURANCE', 'HEALTH INSURANCE', 'HOME INSURANCE',
    'PHONE', 'INTERNET', 'CABLE', 'STREAMING', 'NETFLIX', 'SPOTIFY',
    'SUBSCRIPTION', 'MEMBERSHIP', 'GYM', 'FITNESS'
  ];
  
  // Investment patterns
  const investmentPatterns = [
    'RRSP', 'TFSA', '401K', 'IRA', 'INVESTMENT', 'STOCK', 'BOND', 'ETF',
    'MUTUAL FUND', 'RETIREMENT', 'PENSION', 'CONTRIBUTION'
  ];
  
  // Guilt-free spending patterns
  const guiltFreePatterns = [
    'CASH', 'ATM', 'WITHDRAWAL', 'CASHBACK', 'GROCERY', 'FOOD', 'RESTAURANT',
    'COFFEE', 'LUNCH', 'DINNER', 'BREAKFAST', 'SNACK', 'DRINK'
  ];
  
  // Short-term savings patterns
  const shortTermPatterns = [
    'SAVINGS', 'EMERGENCY', 'VACATION', 'TRAVEL', 'HOLIDAY', 'GIFT', 'PRESENT',
    'WEDDING', 'BIRTHDAY', 'CHRISTMAS', 'HOLIDAY'
  ];
  
  // Check patterns
  for (const pattern of fixedCostsPatterns) {
    if (m.includes(pattern)) {
      return { category: 'fixed_costs', source: 'ml', explain: `ML: ${pattern} → fixed_costs` };
    }
  }
  
  for (const pattern of investmentPatterns) {
    if (m.includes(pattern)) {
      return { category: 'investments', source: 'ml', explain: `ML: ${pattern} → investments` };
    }
  }
  
  for (const pattern of guiltFreePatterns) {
    if (m.includes(pattern)) {
      return { category: 'guilt_free', source: 'ml', explain: `ML: ${pattern} → guilt_free` };
    }
  }
  
  for (const pattern of shortTermPatterns) {
    if (m.includes(pattern)) {
      return { category: 'short_term_savings', source: 'ml', explain: `ML: ${pattern} → short_term_savings` };
    }
  }
  
  // Amount-based heuristics
  if (amount > 1000) {
    // Large amounts are likely fixed costs or investments
    if (m.includes('PAYMENT') || m.includes('BILL')) {
      return { category: 'fixed_costs', source: 'ml', explain: 'ML: Large payment → fixed_costs' };
    }
    return { category: 'investments', source: 'ml', explain: 'ML: Large amount → investments' };
  }
  
  if (amount < 50) {
    // Small amounts are likely guilt-free spending
    return { category: 'guilt_free', source: 'ml', explain: 'ML: Small amount → guilt_free' };
  }
  
  return null;
}

export async function addUserRule({ category, match_type, pattern, explain }) {
  const rules = loadJSON('rules.json');
  const priority = Math.max(1000, ...rules.map(r => r.priority || 0)) + 1; // always win
  const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newRule = { 
    id: ruleId,
    category, 
    match_type, 
    pattern, 
    priority, 
    enabled: true, 
    explain: explain || 'User override',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString() 
  };
  rules.push(newRule);
  saveJSON('rules.json', rules);
  
  // Automatically reapply categorization to all non-manually-overridden transactions
  await reapplyCategories();
  
  return ruleId;
}

export async function reapplyCategories() {
  // Import db here to avoid circular dependency
  const { db } = await import('../db.js');
  
  const rows = db.prepare(`SELECT id, name, description FROM transactions WHERE manual_override=0`).all();
  let updated = 0;
  
  for (const r of rows) {
    const guess = guessCategory(r);
    if (guess && guess.category) {
      db.prepare(`UPDATE transactions SET category=?, category_source=?, category_explain=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(guess.category, guess.source, guess.explain, r.id);
      updated++;
    }
  }
  
  console.log(`Reapplied categories to ${updated} transactions.`);
  return { updated, total: rows.length };
}
