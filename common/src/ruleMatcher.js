/**
 * Shared rule matching logic for both frontend and backend
 * This ensures consistency in rule application across the application
 */

// Configuration for normalization (matches backend autoRuleGenerator.js)
const CONFIG = {
  STORE_NUMBER_PATTERN: /#?\d{2,5}/g,
  PHONE_PATTERN: /\(\d{3}\)\s*\d{3}-\d{4}|\d{3}-\d{3}-\d{4}/g,
  AMOUNT_PATTERN: /\$[\d,]+\.?\d*/g,
  DATE_PATTERN: /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/g,
  REFERENCE_PATTERN: /ref[#:]?\s*\d+/gi,
  PAYMENT_RAIL_NOISE: [
    'visa debit', 'interac', 'pos', 'purchase', 'debit', 'credit',
    'atm', 'cash withdrawal', 'online banking', 'mobile payment'
  ],
  BRAND_CANONICALIZATION: {
    'mcdonald\'s': 'mcdonalds',
    'mcdonalds': 'mcdonalds',
    'costco wholesale': 'costco',
    'walmart supercenter': 'walmart',
    'target corporation': 'target',
    'home depot': 'homedepot',
    'lowes companies': 'lowes',
    'starbucks coffee': 'starbucks',
    'tim hortons': 'timhortons',
    'subway restaurants': 'subway'
  }
};

/**
 * Normalize merchant string for pattern matching
 * @param {string} merchant - Raw merchant string
 * @returns {Object} - { raw, normalized }
 */
export function normalizeMerchant(merchant) {
  if (!merchant) return { raw: '', normalized: '' };
  
  const raw = merchant.trim();
  let normalized = raw.toLowerCase();
  
  // Remove punctuation and emojis
  normalized = normalized.replace(/[^\w\s]/g, ' ');
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Remove variable tokens
  normalized = normalized.replace(CONFIG.STORE_NUMBER_PATTERN, '');
  normalized = normalized.replace(CONFIG.PHONE_PATTERN, '');
  normalized = normalized.replace(CONFIG.AMOUNT_PATTERN, '');
  normalized = normalized.replace(CONFIG.DATE_PATTERN, '');
  normalized = normalized.replace(CONFIG.REFERENCE_PATTERN, '');
  
  // Remove payment rail noise
  for (const noise of CONFIG.PAYMENT_RAIL_NOISE) {
    normalized = normalized.replace(new RegExp(`\\b${noise}\\b`, 'gi'), '');
  }
  
  // Canonicalize brand variants
  for (const [variant, canonical] of Object.entries(CONFIG.BRAND_CANONICALIZATION)) {
    if (normalized.includes(variant)) {
      normalized = normalized.replace(new RegExp(`\\b${variant}\\b`, 'gi'), canonical);
    }
  }
  
  // Clean up again after replacements
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return { raw, normalized };
}

/**
 * Parse labels from various formats (array, JSON string, null, undefined)
 * @param {any} labels - Labels in any format
 * @returns {Array<string>} - Array of label strings
 */
export function parseLabels(labels) {
  if (!labels) return [];
  if (Array.isArray(labels)) return labels;
  if (typeof labels === 'string') {
    try {
      const parsed = JSON.parse(labels);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Merge transaction labels with rule labels, removing duplicates
 * @param {any} transactionLabels - Labels from transaction (any format)
 * @param {any} ruleLabels - Labels from rule (any format)
 * @returns {Array<string>} - Merged array of unique labels
 */
export function mergeLabels(transactionLabels, ruleLabels) {
  const existing = parseLabels(transactionLabels);
  const rule = parseLabels(ruleLabels);
  // Combine labels, removing duplicates
  return [...new Set([...existing, ...rule])];
}

/**
 * Optimized matching function that uses pre-normalized data
 * Use this when you know both rule and transaction are already normalized
 * @param {Object} rule - Rule object with _normalizedPattern, _regexPattern, _matchType
 * @param {Object} transaction - Transaction object with _merchantNormalized, _descriptionNormalized
 * @returns {boolean} - Whether the transaction matches the rule
 */
export function matchesRuleOptimized(rule, transaction) {
  // Use pre-normalized values if available
  const normalizedPattern = rule._normalizedPattern;
  const merchantNormalized = transaction._merchantNormalized || '';
  const descriptionNormalized = transaction._descriptionNormalized || '';
  const matchType = rule._matchType || rule.match_type || rule.type || 'contains';
  
  let result = false;
  switch (matchType) {
    case 'exact':
      // Use pre-normalized pattern and transaction text for exact matching
      if (normalizedPattern !== undefined) {
        result = merchantNormalized === normalizedPattern || descriptionNormalized === normalizedPattern;
      }
      break;
    case 'contains':
      // Use pre-normalized pattern and transaction text for contains matching
      if (normalizedPattern !== undefined) {
        result = merchantNormalized.includes(normalizedPattern) || descriptionNormalized.includes(normalizedPattern);
      }
      break;
    case 'regex':
      // Prefer pre-compiled regex for best performance
      if (rule._regexPattern) {
        result = rule._regexPattern.test(merchantNormalized) || rule._regexPattern.test(descriptionNormalized);
      } else if (rule.pattern) {
        // Fallback: compile regex on-the-fly if not pre-compiled (shouldn't happen in optimized path)
        try {
          const regex = new RegExp(rule.pattern, 'i');
          result = regex.test(merchantNormalized) || regex.test(descriptionNormalized);
        } catch (e) {
          result = false;
        }
      }
      break;
    case 'mcc':
      // MCC matching doesn't need normalization
      result = transaction.mcc === rule.pattern;
      break;
    case 'inflow':
      // Match transactions where inflow is true
      const inflow = transaction.inflow;
      result = inflow === 1 || inflow === true || inflow === '1';
      break;
    default:
      result = false;
  }
  
  // For recurring_analysis rules, also check the amount matches
  if (result && rule.source === 'recurring_analysis' && rule.amount !== undefined) {
    const txAmount = Math.abs(Number(transaction.amount));
    const ruleAmount = Math.abs(Number(rule.amount));
    result = Math.abs(txAmount - ruleAmount) < 0.01;
  }
  
  return result;
}

/**
 * Check if a transaction matches a rule
 * @param {Object} rule - Rule object with pattern, match_type, etc.
 * @param {Object} transaction - Transaction object with name, description, etc.
 * @returns {boolean} - Whether the transaction matches the rule
 */
export function matchesRule(rule, transaction) {
  // If pre-normalized data is available, use optimized path
  if (rule._normalizedPattern !== undefined && 
      (transaction._merchantNormalized !== undefined || transaction._descriptionNormalized !== undefined)) {
    return matchesRuleOptimized(rule, transaction);
  }
  
  // Fallback to original implementation for backward compatibility
  const pattern = rule.pattern || '';
  const matchType = rule.match_type || rule.type || 'contains';
  
  // Normalize the pattern
  const normalizedPattern = normalizeMerchant(pattern).normalized;
  
  // Get normalized transaction text
  const merchantNormalized = normalizeMerchant(transaction.name || '').normalized;
  const descriptionNormalized = normalizeMerchant(transaction.description || '').normalized;
  
  let result = false;
  switch (matchType) {
    case 'exact':
      result = merchantNormalized === normalizedPattern || descriptionNormalized === normalizedPattern;
      break;
    case 'contains':
      result = merchantNormalized.includes(normalizedPattern) || descriptionNormalized.includes(normalizedPattern);
      break;
    case 'regex':
      try {
        const regex = new RegExp(pattern, 'i');
        result = regex.test(merchantNormalized) || regex.test(descriptionNormalized);
      } catch (e) {
        result = false;
      }
      break;
    case 'mcc':
      result = transaction.mcc === pattern;
      break;
    case 'inflow':
      // Match transactions where inflow is true
      const inflow = transaction.inflow;
      result = inflow === 1 || inflow === true || inflow === '1';
      break;
    default:
      result = false;
  }
  
  // For recurring_analysis rules, also check the amount matches
  // This ensures rules created from specific merchant:amount combinations only match transactions with that exact amount
  if (result && rule.source === 'recurring_analysis' && rule.amount !== undefined) {
    const txAmount = Math.abs(Number(transaction.amount));
    const ruleAmount = Math.abs(Number(rule.amount));
    // Allow small floating point differences (0.01 tolerance)
    result = Math.abs(txAmount - ruleAmount) < 0.01;
  }
  
  return result;
}

/**
 * Apply rules to transactions and return categorized transactions
 * @param {Array} transactions - Array of transactions
 * @param {Array} rules - Array of rules (sorted by priority, highest first)
 * @returns {Array} - Array of transactions with category information
 */
export function applyRulesToTransactions(transactions, rules) {
  const categorizedTransactions = [];
  const coveredTransactions = new Set();
  
  // Pre-normalize transactions (ONCE) - major performance optimization
  const normalizedTransactions = transactions.map(tx => ({
    ...tx,
    _merchantNormalized: normalizeMerchant(tx.name || '').normalized,
    _descriptionNormalized: normalizeMerchant(tx.description || '').normalized
  }));
  
  // Sort rules by priority (highest first)
  const sortedRules = [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    // If same priority, most recent wins
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
  
  // Pre-normalize rules (ONCE) - major performance optimization
  const normalizedRules = sortedRules.map(rule => ({
    ...rule,
    _normalizedPattern: normalizeMerchant(rule.pattern || '').normalized,
    _regexPattern: rule.match_type === 'regex' ? (() => {
      try {
        return new RegExp(rule.pattern, 'i');
      } catch (e) {
        return null;
      }
    })() : null,
    _matchType: rule.match_type || rule.type || 'contains'
  }));
  
  // Process each transaction with pre-normalized data
  for (const transaction of normalizedTransactions) {
    // Skip transactions with manual_override (user overrides should not be recategorized)
    if (transaction.manual_override === 1 || transaction.manual_override === true) {
      // Preserve the transaction as-is without applying rules
      categorizedTransactions.push({
        ...transaction,
        // Keep existing category and source
        category: transaction.category || null,
        labels: transaction.labels || [],
        category_source: transaction.category_source || 'manual',
        category_explain: transaction.category_explain || 'Manual override',
        rule_type: 'manual_override'
      });
      continue;
    }
    
    let matched = false;
    
    // Check each rule in priority order
    for (const rule of normalizedRules) {
      if (!rule.enabled) continue;
      if (coveredTransactions.has(transaction.hash)) continue;
      
      // Use optimized matching with pre-normalized data
      if (matchesRuleOptimized(rule, transaction)) {
        // Merge existing transaction labels with rule labels
        const mergedLabels = mergeLabels(transaction.labels, rule.labels);
        
        categorizedTransactions.push({
          ...transaction,
          category: rule.category,
          labels: mergedLabels,
          category_source: 'rule',
          category_explain: rule.explain || 'Rule match',
          rule_id: rule.id,
          rule_type: 'user_rule'
        });
        coveredTransactions.add(transaction.hash);
        matched = true;
        break; // First match wins
      }
    }
    
    // If no rule matched, add without category but preserve existing labels
    if (!matched) {
      // Preserve existing labels (e.g., 'transfer' label)
      const existingLabels = parseLabels(transaction.labels);
      
      categorizedTransactions.push({
        ...transaction,
        category: null,
        labels: existingLabels,
        category_source: 'none',
        category_explain: 'No match',
        rule_type: 'none'
      });
    }
  }
  
  return categorizedTransactions;
}

/**
 * Apply rules to transactions and return detailed matching information
 * This is used for preview purposes
 * @param {Array} transactions - Array of transactions
 * @param {Array} rules - Array of rules (sorted by priority, highest first)
 * @param {Object} options - Options including { skipSort: boolean }
 * @returns {Object} - Object with categorized transactions and rule matches
 */
export function applyRulesWithDetails(transactions, rules, options = {}) {
  const { skipSort = false } = options;
  const categorizedTransactions = [];
  const coveredTransactions = new Set();
  const ruleMatches = new Map(); // Map of ruleId -> matching transactions
  
  // Pre-normalize transactions (ONCE) - major performance optimization
  const normalizedTransactions = transactions.map(tx => ({
    ...tx,
    _merchantNormalized: normalizeMerchant(tx.name || '').normalized,
    _descriptionNormalized: normalizeMerchant(tx.description || '').normalized
  }));
  
  // Sort rules by priority (highest first) - skip if already sorted
  const sortedRules = skipSort ? rules : [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    // If same priority, most recent wins
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
  
  // Pre-normalize rules (ONCE) - major performance optimization
  const normalizedRules = sortedRules.map(rule => ({
    ...rule,
    _normalizedPattern: normalizeMerchant(rule.pattern || '').normalized,
    _regexPattern: rule.match_type === 'regex' ? (() => {
      try {
        return new RegExp(rule.pattern, 'i');
      } catch (e) {
        return null;
      }
    })() : null,
    _matchType: rule.match_type || rule.type || 'contains'
  }));
  
  // Initialize rule matches map
  for (const rule of normalizedRules) {
    ruleMatches.set(rule.id, []);
  }
  
  // Process each transaction with pre-normalized data
  for (const transaction of normalizedTransactions) {
    // Skip transactions with manual_override (user overrides should not be recategorized)
    if (transaction.manual_override === 1 || transaction.manual_override === true) {
      // Preserve the transaction as-is without applying rules
      categorizedTransactions.push({
        ...transaction,
        // Keep existing category and source
        category: transaction.category || null,
        labels: transaction.labels || [],
        category_source: transaction.category_source || 'manual',
        category_explain: transaction.category_explain || 'Manual override',
        rule_type: 'manual_override'
      });
      continue;
    }
    
    let matched = false;
    
    // Check each rule in priority order
    for (const rule of normalizedRules) {
      if (!rule.enabled) continue;
      if (coveredTransactions.has(transaction.hash)) continue;
      
      // Use optimized matching with pre-normalized data
      if (matchesRuleOptimized(rule, transaction)) {
        // Merge existing transaction labels with rule labels
        const mergedLabels = mergeLabels(transaction.labels, rule.labels);
        
        const categorizedTransaction = {
          ...transaction,
          category: rule.category,
          labels: mergedLabels,
          category_source: 'rule',
          category_explain: rule.explain || 'Rule match',
          rule_id: rule.id,
          rule_type: 'user_rule'
        };
        
        categorizedTransactions.push(categorizedTransaction);
        coveredTransactions.add(transaction.hash);
        ruleMatches.get(rule.id).push(categorizedTransaction);
        matched = true;
        break; // First match wins
      }
    }
    
    // If no rule matched, add without category but preserve existing labels
    if (!matched) {
      // Preserve existing labels (e.g., 'transfer' label)
      const existingLabels = parseLabels(transaction.labels);
      
      categorizedTransactions.push({
        ...transaction,
        category: null,
        labels: existingLabels,
        category_source: 'none',
        category_explain: 'No match',
        rule_type: 'none'
      });
    }
  }
  
  return {
    categorizedTransactions,
    ruleMatches,
    coveredTransactions: Array.from(coveredTransactions)
  };
}

/**
 * Get transactions that match a specific rule
 * @param {Object} rule - Rule object
 * @param {Array} transactions - Array of transactions
 * @returns {Array} - Array of matching transactions
 */
export function getTransactionsForRule(rule, transactions) {
  // Skip transactions with manual_override (user overrides should not be matched)
  return transactions.filter(tx => {
    if (tx.manual_override === 1 || tx.manual_override === true) return false;
    return matchesRule(rule, tx);
  });
}

/**
 * Get unmatched transactions (transactions that don't match any rule)
 * @param {Array} transactions - Array of transactions
 * @param {Array} rules - Array of rules
 * @returns {Array} - Array of unmatched transactions
 */
export function getUnmatchedTransactions(transactions, rules) {
  // Pre-normalize transactions (ONCE) - major performance optimization
  const normalizedTransactions = transactions.map(tx => ({
    ...tx,
    _merchantNormalized: normalizeMerchant(tx.name || '').normalized,
    _descriptionNormalized: normalizeMerchant(tx.description || '').normalized
  }));
  
  const sortedRules = [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
  
  // Pre-normalize rules (ONCE) - major performance optimization
  const normalizedRules = sortedRules.map(rule => ({
    ...rule,
    _normalizedPattern: normalizeMerchant(rule.pattern || '').normalized,
    _regexPattern: rule.match_type === 'regex' ? (() => {
      try {
        return new RegExp(rule.pattern, 'i');
      } catch (e) {
        return null;
      }
    })() : null,
    _matchType: rule.match_type || rule.type || 'contains'
  }));
  
  const coveredTransactions = new Set();
  
  // Mark transactions covered by rules
  for (const rule of normalizedRules) {
    if (!rule.enabled) continue;
    
    for (const transaction of normalizedTransactions) {
      // Skip transactions with manual_override
      if (transaction.manual_override === 1 || transaction.manual_override === true) continue;
      if (coveredTransactions.has(transaction.hash)) continue;
      
      // Use optimized matching with pre-normalized data
      if (matchesRuleOptimized(rule, transaction)) {
        coveredTransactions.add(transaction.hash);
      }
    }
  }
  
  // Return original transactions (not normalized versions) that weren't covered
  return transactions.filter(tx => !coveredTransactions.has(tx.hash));
}
