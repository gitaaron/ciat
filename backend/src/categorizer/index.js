
import { Rules } from '../models.js';

// Import shared rule matching logic from common folder
import { normalizeMerchant, matchesRule, applyRulesToTransactions, applyRulesWithDetails, getTransactionsForRule, getUnmatchedTransactions } from '../../../common/src/ruleMatcher.js';

function normalize(s='') {
  // Use the same normalization as auto rule generator for consistency
  return normalizeMerchant(s).normalized;
}

export function guessCategory(tx) {
  const rules = Rules.findEnabled();

  // Check rules in priority order using shared matching logic
  for (const r of rules) {
    if (matchesRule(r, tx)) {
      return { 
        category: r.category, 
        labels: r.labels || [],
        source: 'rule', 
        explain: r.explain || 'Rule match',
        rule_id: r.id,
        rule_type: 'user_rule'
      };
    }
  }
  
  // ML fallback
  const ml = mlGuess(tx);
  if (ml) return { ...ml, labels: [], rule_type: 'ml' };
  return { category: null, labels: [], source: 'none', explain: 'No match', rule_type: 'none' };
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

export async function addUserRule({ category, match_type, pattern, explain, labels, priority }) {
  // Use priority if explicitly provided (even if 0), otherwise get next priority
  const rulePriority = (priority !== undefined && priority !== null) ? priority : Rules.getNextPriority();
  const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newRule = { 
    id: ruleId,
    category, 
    match_type, 
    pattern, 
    priority: rulePriority, 
    enabled: true, 
    explain: explain || 'User override',
    labels: labels || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString() 
  };
  
  Rules.create(newRule);
  return newRule;
}

export async function updateUserRule(ruleId, { category, match_type, pattern, explain, labels, priority }) {
  const existingRule = Rules.findById(ruleId);
  
  if (!existingRule) {
    throw new Error(`Rule with ID ${ruleId} not found`);
  }
  
  // Update the rule
  // Preserve priority if not provided, but allow updating it if explicitly provided
  const updatedPriority = (priority !== undefined && priority !== null) ? priority : existingRule.priority;
  const updatedRule = {
    ...existingRule,
    category,
    match_type,
    pattern,
    priority: updatedPriority,
    explain: explain || existingRule.explain,
    labels: labels !== undefined ? labels : existingRule.labels,
    updated_at: new Date().toISOString()
  };
  
  Rules.update(ruleId, updatedRule);
  
  return { updated: true, ruleId, rule: updatedRule };
}


export async function deleteUserRule(ruleId) {
  const existingRule = Rules.findById(ruleId);
  
  if (!existingRule) {
    throw new Error(`Rule with ID ${ruleId} not found`);
  }
  
  Rules.delete(ruleId);
  
  return { deleted: true, ruleId };
}


export async function toggleUserRule(ruleId, enabled) {
  const existingRule = Rules.findById(ruleId);
  
  if (!existingRule) {
    throw new Error(`Rule with ID ${ruleId} not found`);
  }
  
  // Update the enabled status
  const updatedRule = {
    ...existingRule,
    enabled,
    updated_at: new Date().toISOString()
  };
  
  Rules.update(ruleId, updatedRule);
  
  return { toggled: true, ruleId, enabled, rule: updatedRule };
}


export async function reapplyCategories() {
  // Import db here to avoid circular dependency
  const { db } = await import('../db.js');
  
  // Get all transactions that are not manually overridden (with all fields needed for matching)
  const transactions = db.prepare(`
    SELECT id, hash, name, description, amount, mcc, category, category_source, category_explain, labels, manual_override
    FROM transactions 
    WHERE manual_override = 0
  `).all();
  
  // Parse labels from JSON strings if needed
  const transactionsWithParsedLabels = transactions.map(tx => ({
    ...tx,
    labels: tx.labels ? (typeof tx.labels === 'string' ? JSON.parse(tx.labels) : tx.labels) : []
  }));
  
  // Get all enabled rules
  const rules = Rules.findEnabled();
  
  // Use optimized rule matching from common folder (already imported at top)
  // This automatically skips manual_override transactions
  const categorizedTransactions = applyRulesToTransactions(transactionsWithParsedLabels, rules);
  
  // Update transactions where category changed
  let updated = 0;
  let changed = 0;
  
  const updateStmt = db.prepare(`
    UPDATE transactions 
    SET category=?, category_source=?, category_explain=?, labels=?, updated_at=CURRENT_TIMESTAMP 
    WHERE id=?
  `);
  
  for (const categorizedTx of categorizedTransactions) {
    const originalTx = transactionsWithParsedLabels.find(tx => tx.id === categorizedTx.id || tx.hash === categorizedTx.hash);
    if (!originalTx) continue;
    
    // Check if category changed
    const categoryChanged = originalTx.category !== categorizedTx.category;
    const labelsChanged = JSON.stringify(originalTx.labels || []) !== JSON.stringify(categorizedTx.labels || []);
    
    if (categoryChanged || labelsChanged) {
      const labelsJson = categorizedTx.labels && Array.isArray(categorizedTx.labels) 
        ? JSON.stringify(categorizedTx.labels) 
        : (categorizedTx.labels || null);
      
      updateStmt.run(
        categorizedTx.category || null,
        categorizedTx.category_source || 'none',
        categorizedTx.category_explain || 'No match',
        labelsJson,
        originalTx.id
      );
      
      updated++;
      if (categoryChanged) changed++;
    }
  }
  
  console.log(`Reapplied categories to ${updated} transactions (${changed} category changes).`);
  return { updated, changed, total: transactions.length };
}

export function getAllRules() {
  return Rules.all();
}

export function getRulesUsedInImport(transactions) {
  const rules = Rules.all();
  const usedRules = new Map();
  
  for (const tx of transactions) {
    if (tx.rule_id && tx.rule_type === 'user_rule') {
      const key = `user_rule:${tx.rule_id}`;
      if (!usedRules.has(key)) {
        const rule = rules.find(r => r.id === tx.rule_id);
        
        if (rule) {
          usedRules.set(key, {
            ...rule,
            type: 'user_rule',
            transactions: []
          });
        }
      }
      
      // Add transaction to the rule
      const rule = usedRules.get(key);
      if (rule) {
        rule.transactions.push(tx);
      }
    }
  }
  
  return Array.from(usedRules.values());
}

export async function generateAutoRules(transactions) {
  console.log('generateAutoRules called with', transactions.length, 'transactions');
  const { generateAutoRules: generateRules, previewRuleImpact } = await import('./autoRuleGenerator.js');
  
  if (!transactions || transactions.length === 0) {
    console.log('No transactions provided, returning empty rules');
    return { rules: [], analysis: null, previews: [] };
  }
  
  // Generate auto rules
  console.log('Calling generateRules with', transactions.length, 'transactions');
  const result = generateRules(transactions);
  console.log('generateRules returned:', result.rules?.length || 0, 'rules');
  
  // Filter out rules that don't actually match any transactions
  // Note: actualMatches from resolveRuleConflicts already reflects priority-resolved count
  // We use that value instead of re-matching to avoid duplicate work
  const filteredRules = result.rules.filter(rule => {
    // actualMatches is already set by resolveRuleConflicts with priority resolution
    // Use it directly instead of re-matching all transactions
    return (rule.actualMatches !== undefined && rule.actualMatches > 0);
  }).map(rule => ({
    ...rule,
    // Store matching transaction hashes if available (from resolveRuleConflicts)
    matchingTransactions: rule.matchingTransactions || []
  }));
  
  console.log(`Filtered auto rules: ${result.rules.length} generated, ${filteredRules.length} with matches`);
  
  // Preview rule impact using filtered rules
  // const previews = previewRuleImpact(filteredRules, transactions);
  const previews = [];
  
  return {
    rules: filteredRules,
    analysis: result.analysis,
    stats: {
      ...result.stats,
      rulesWithMatches: filteredRules.length,
      rulesFilteredOut: result.rules.length - filteredRules.length
    },
    previews
  };
}

export async function applyAutoRules(rulesToApply, transactions) {
  let appliedCount = 0;

  for (const rule of rulesToApply) {
    try {
      // Convert auto rule to user rule format
      const userRule = {
        category: rule.category,
        match_type: rule.match_type || (rule.type === 'mcc' ? 'exact' : rule.type),
        pattern: rule.pattern,
        explain: rule.explain || `Auto-generated: "${rule.pattern}" ${rule.match_type || rule.type} rule`,
        labels: rule.labels || [],
        priority: rule.priority || 500
      };

      await addUserRule(userRule);
      appliedCount++;
    } catch (error) {
      console.error(`Failed to apply auto rule ${rule.id}:`, error);
    }
  }

  return { applied: appliedCount, total: rulesToApply.length };
}

// Rule matching functions are now imported from common folder
