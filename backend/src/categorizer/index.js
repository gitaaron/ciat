
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadJSON(name) {
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
  const rules = loadJSON('rules.json').filter(r => r.enabled !== false).sort((a,b)=>b.priority-a.priority);
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
  // Placeholder: route "CASH" to guilt_free; "RENT" to fixed_costs; "RRSP" to investments
  const m = normalize(tx.name || tx.description || '');
  if (m.includes('RENT')) return { category: 'fixed_costs', source: 'ml', explain: 'ML stub: RENT → fixed_costs' };
  if (m.includes('RRSP') or m.includes('TFSA')) return { category: 'investments', source: 'ml', explain: 'ML stub: contributions' };
  if (m.includes('CASH')) return { category: 'guilt_free', source: 'ml', explain: 'ML stub: cash → guilt_free' };
  return null;
}

export function addUserRule({ category, match_type, pattern, explain }) {
  const rules = loadJSON('rules.json');
  const priority = Math.max(1000, ...rules.map(r => r.priority || 0)) + 1; // always win
  rules.push({ category, match_type, pattern, priority, enabled: true, explain: explain || 'User override' , updated_at: new Date().toISOString() });
  saveJSON('rules.json', rules);
}
