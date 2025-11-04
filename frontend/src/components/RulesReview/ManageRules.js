import { computed } from 'vue'
import { getCategoryName } from '../../config/categories.js'
import { createRuleUtils } from './ruleUtils.js'

export default function ManageRulesJS(props, { emit }) {
  // Get shared rule utilities
  const {
    showSnackMessage,
    toggleExpanded,
    startEditing,
    saveEdit,
    cancelEdit,
    deleteRule
  } = createRuleUtils()

  // Computed properties for each section
  const newRules = computed(() => {
    const rulesArray = props.newRules || []
    const newRuleMatches = props.newRuleMatches
    
    if (rulesArray.length === 0) {
      return []
    }
    
    const result = rulesArray
      .map(rule => {
        const transactions = newRuleMatches?.get(rule.id) || []
        return {
          ...rule,
          transactions: Array.isArray(transactions) ? transactions : [],
          actualMatches: transactions.length
        }
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority
        return 0
      })

    // Create new object references to ensure Vue reactivity detects changes
    return result.map(rule => ({
      ...rule,
      transactions: rule.transactions ? [...rule.transactions] : []
    }))
  })

  const existingRules = computed(() => {
    if (!props.usedRules) return []
    
    return props.usedRules
      .map(rule => {
        const transactions = props.existingRuleMatches.get(rule.id) || []
        return {
          ...rule,
          transactions
        }
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority
        return 0
      })
  })

  const effectiveAutoRules = computed(() => {
    if (!props.autoRules || !props.autoRules.rules) return []
    
    const rules = props.autoRules.rules
      .filter(rule => !rule.applied)
      .map(rule => {
        const transactions = props.autoRuleMatches.get(rule.id) || []
        return {
          ...rule,
          transactions,
          // Update actualMatches to match the priority-resolved transaction count
          // This ensures consistency between the count and the displayed transactions
          actualMatches: transactions.length
        }
      })
    
    return rules
  })

  const totalMatches = computed(() => {
    if (!props.newRuleMatches) return 0
    let total = 0
    for (const transactions of props.newRuleMatches.values()) {
      total += transactions.length
    }
    return total
  })

  const uniqueCategories = computed(() => {
    const categories = new Set()
    newRules.value.forEach(rule => {
      if (rule.category) {
        categories.add(rule.category)
      }
    })
    return categories
  })

  const ruleTypeCounts = computed(() => {
    const counts = {
      contains: 0,
      regex: 0,
      exact: 0
    }
    
    newRules.value.forEach(rule => {
      const matchType = rule.match_type || rule.type || 'contains'
      if (counts.hasOwnProperty(matchType)) {
        counts[matchType]++
      } else {
        counts.contains++
      }
    })
    
    return counts
  })

  // New Rules section functions
  const removeNew = (rule) => deleteRule(rule, emit)

  // Existing Rules section functions
  const removeExisting = (rule) => deleteRule(rule, emit)

  // Auto Rules section functions
  const removeAuto = (rule) => deleteRule(rule, emit)

  // Handle rule creation from any RulesReview component
  const handleRuleCreated = (newRule) => {
    emit('rule-created', newRule)
  }

  return {
    
    // Computed properties
    newRulesWithTransactions: newRules,
    existingRules,
    effectiveAutoRules,
    totalMatches,
    uniqueCategories,
    ruleTypeCounts,
    
    // Methods
    getCategoryName,
    showSnackMessage,
    
    // New Rules section methods
    removeNew,
    
    // Existing Rules section methods
    removeExisting,
    
    // Auto Rules section methods
    removeAuto,
    
    // Rule creation handling
    handleRuleCreated
  }
}
