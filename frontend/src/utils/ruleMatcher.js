// Re-export shared rule matching logic from common folder
export { 
  normalizeMerchant, 
  matchesRule, 
  applyRulesToTransactions, 
  applyRulesWithDetails, 
  getTransactionsForRule, 
  getUnmatchedTransactions 
} from '../../../common/src/ruleMatcher.js';
