
import { Rules, AutogenRules, Accounts } from '../models.js';

// Import shared rule matching logic from common folder
import { normalizeMerchant, matchesRule, applyRulesToTransactions, applyRulesWithDetails, getTransactionsForRule, getUnmatchedTransactions, parseLabels, mergeLabels } from '../../../common/src/ruleMatcher.js';
import { loadSystemRules } from '../utils/systemRules.js';

function normalize(s='') {
  // Use the same normalization as auto rule generator for consistency
  return normalizeMerchant(s).normalized;
}

/**
 * Get all system-level rules (lowest priority)
 * These rules are loaded from the system-rules.json file
 */
function getSystemRules() {
  return loadSystemRules();
}

export function guessCategory(tx) {
  // Preserve existing labels (e.g., 'transfer' label)
  const existingLabels = parseLabels(tx.labels);
  
  // Fetch account information if account_id is present (needed for account type filtering)
  let account = null;
  if (tx.account_id) {
    account = Accounts.findById(tx.account_id);
  }
  
  const userRules = Rules.findEnabled();
  const autogenRules = AutogenRules.findEnabled();
  // Add system rules at the end (lowest priority)
  const systemRules = getSystemRules();
  
  // Create a map of autogen rule IDs for quick lookup
  const autogenRuleIds = new Set(autogenRules.map(r => r.id));
  
  // Combine all rules in priority order
  const allRules = [...userRules, ...autogenRules, ...systemRules];

  // Check rules in priority order using shared matching logic
  for (const r of allRules) {
    if (matchesRule(r, tx, account)) {
      // Merge existing labels with rule labels, removing duplicates
      const mergedLabels = mergeLabels(tx.labels, r.labels);
      
      // Determine rule type
      let ruleType = 'user_rule';
      if (r.source === 'system') {
        ruleType = 'system_rule';
      } else if (autogenRuleIds.has(r.id)) {
        ruleType = 'autogen_rule';
      }
      
      return { 
        category: r.category, 
        labels: mergedLabels,
        source: 'rule', 
        explain: r.explain || 'Rule match',
        rule_id: r.id,
        rule_type: ruleType
      };
    }
  }
  
  // ML fallback
  const ml = mlGuess(tx);
  if (ml) return { ...ml, labels: existingLabels, rule_type: 'ml' };
  return { category: 'uncategorized', labels: existingLabels, source: 'none', explain: 'No match', rule_type: 'none' };
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

export async function addUserRule({ category, match_type, pattern, explain, labels, priority, account_id, start_date, end_date, min_amount, max_amount, inflow_only, outflow_only }) {
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
    explain: explain || 'User created rule',
    labels: labels || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Add optional fields if provided
  if (account_id !== undefined && account_id !== null) {
    newRule.account_id = account_id;
  }
  if (start_date !== undefined && start_date !== null) {
    newRule.start_date = start_date;
  }
  if (end_date !== undefined && end_date !== null) {
    newRule.end_date = end_date;
  }
  if (min_amount !== undefined && min_amount !== null) {
    newRule.min_amount = min_amount;
  }
  if (max_amount !== undefined && max_amount !== null) {
    newRule.max_amount = max_amount;
  }
  if (inflow_only !== undefined && inflow_only !== null) {
    newRule.inflow_only = inflow_only;
  }
  if (outflow_only !== undefined && outflow_only !== null) {
    newRule.outflow_only = outflow_only;
  }
  
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
    SELECT id, account_id, hash, name, description, amount, category, category_source, category_explain, labels, manual_override, inflow
    FROM transactions 
    WHERE manual_override = 0
  `).all();
  
  // Parse labels from JSON strings if needed
  const transactionsWithParsedLabels = transactions.map(tx => ({
    ...tx,
    labels: parseLabels(tx.labels)
  }));
  
  // Fetch all accounts and create a map for quick lookup
  const allAccounts = Accounts.all();
  const accountsMap = {};
  for (const account of allAccounts) {
    accountsMap[account.id] = account;
  }
  
  // Get all enabled rules (user, autogen, and system)
  const userRules = Rules.findEnabled();
  const autogenRules = AutogenRules.findEnabled();
  // Add system rules at the end (lowest priority)
  const systemRules = getSystemRules();
  const allRules = [...userRules, ...autogenRules, ...systemRules];
  
  // Use optimized rule matching from common folder (already imported at top)
  // This automatically skips manual_override transactions
  const categorizedTransactions = applyRulesToTransactions(transactionsWithParsedLabels, allRules, { accounts: accountsMap });
  
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
  const userRules = Rules.all();
  const autogenRules = AutogenRules.all();
  // Combine and sort by priority
  const allRules = [...userRules, ...autogenRules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();
    return bTime - aTime;
  });
  return allRules;
}

export function getUserRules() {
  return Rules.all();
}

export function getAutogenRules() {
  return AutogenRules.all();
}

export function getRulesUsedInImport(transactions) {
  const userRules = Rules.all();
  const autogenRules = AutogenRules.all();
  const allRules = [...userRules, ...autogenRules];
  const usedRules = new Map();
  
  for (const tx of transactions) {
    if (tx.rule_id && (tx.rule_type === 'user_rule' || tx.rule_type === 'autogen_rule')) {
      const ruleType = tx.rule_type === 'autogen_rule' ? 'autogen_rule' : 'user_rule';
      const key = `${ruleType}:${tx.rule_id}`;
      if (!usedRules.has(key)) {
        const rule = allRules.find(r => r.id === tx.rule_id);
        
        if (rule) {
          usedRules.set(key, {
            ...rule,
            type: ruleType,
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
      // Convert auto rule to autogen rule format
      const autogenRule = {
        id: rule.id || `autogen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        category: rule.category,
        match_type: rule.match_type || (rule.type === 'mcc' ? 'exact' : rule.type),
        pattern: rule.pattern,
        explain: rule.explain || `Auto-generated: "${rule.pattern}" ${rule.match_type || rule.type} rule`,
        labels: rule.labels || [],
        priority: rule.priority || 500,
        support: rule.support || 0,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      AutogenRules.create(autogenRule);
      appliedCount++;
    } catch (error) {
      console.error(`Failed to apply auto rule ${rule.id}:`, error);
    }
  }

  return { applied: appliedCount, total: rulesToApply.length };
}

// Rule matching functions are now imported from common folder
