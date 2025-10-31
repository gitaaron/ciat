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
 * Check if a transaction matches a rule
 * @param {Object} rule - Rule object with pattern, match_type, etc.
 * @param {Object} transaction - Transaction object with name, description, etc.
 * @returns {boolean} - Whether the transaction matches the rule
 */
export function matchesRule(rule, transaction) {
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
  
  // Sort rules by priority (highest first)
  const sortedRules = [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    // If same priority, most recent wins
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
  
  // Process each transaction
  for (const transaction of transactions) {
    let matched = false;
    
    // Check each rule in priority order
    for (const rule of sortedRules) {
      if (!rule.enabled) continue;
      if (coveredTransactions.has(transaction.hash)) continue;
      
      if (matchesRule(rule, transaction)) {
        categorizedTransactions.push({
          ...transaction,
          category: rule.category,
          labels: rule.labels || [],
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
    
    // If no rule matched, add without category
    if (!matched) {
      categorizedTransactions.push({
        ...transaction,
        category: null,
        labels: [],
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
 * @returns {Object} - Object with categorized transactions and rule matches
 */
export function applyRulesWithDetails(transactions, rules) {
  const categorizedTransactions = [];
  const coveredTransactions = new Set();
  const ruleMatches = new Map(); // Map of ruleId -> matching transactions
  
  // Sort rules by priority (highest first)
  const sortedRules = [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    // If same priority, most recent wins
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
  
  // Initialize rule matches map
  for (const rule of sortedRules) {
    ruleMatches.set(rule.id, []);
  }
  
  // Process each transaction
  for (const transaction of transactions) {
    let matched = false;
    
    // Check each rule in priority order
    for (const rule of sortedRules) {
      if (!rule.enabled) continue;
      if (coveredTransactions.has(transaction.hash)) continue;
      
      if (matchesRule(rule, transaction)) {
        const categorizedTransaction = {
          ...transaction,
          category: rule.category,
          labels: rule.labels || [],
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
    
    // If no rule matched, add without category
    if (!matched) {
      categorizedTransactions.push({
        ...transaction,
        category: null,
        labels: [],
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
  return transactions.filter(tx => matchesRule(rule, tx));
}

/**
 * Get unmatched transactions (transactions that don't match any rule)
 * @param {Array} transactions - Array of transactions
 * @param {Array} rules - Array of rules
 * @returns {Array} - Array of unmatched transactions
 */
export function getUnmatchedTransactions(transactions, rules) {
  const sortedRules = [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
  
  const coveredTransactions = new Set();
  
  // Mark transactions covered by rules
  for (const rule of sortedRules) {
    if (!rule.enabled) continue;
    
    for (const transaction of transactions) {
      if (coveredTransactions.has(transaction.hash)) continue;
      
      if (matchesRule(rule, transaction)) {
        coveredTransactions.add(transaction.hash);
      }
    }
  }
  
  // Return transactions not covered by any rule
  return transactions.filter(tx => !coveredTransactions.has(tx.hash));
}
