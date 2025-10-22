import { ref, computed } from 'vue'
import { useRulesReview } from '../../shared/RulesReviewMixin.js'

export default function NewRulesReviewJS(props, { emit }) {
  // Use shared rules review functionality
  const {
    showSnack,
    snackMessage,
    getCategoryName,
    showSnackMessage,
    toggleExpanded: sharedToggleExpanded,
    startEditing: sharedStartEditing,
    saveEdit: sharedSaveEdit,
    cancelEdit: sharedCancelEdit,
    deleteRule: sharedDeleteRule
  } = useRulesReview()

  // Component-specific state
  const expandedRules = ref(new Set())
  const editingRule = ref(null)
  
  // Create rule dialog state
  const showCreateRuleDialog = ref(false)
  const createRuleTransaction = ref(null)
  const createRuleData = ref({
    match_type: 'contains',
    pattern: '',
    category: '',
    labels: []
  })

  // Computed properties
  const totalMatches = computed(() => {
    if (!props.ruleMatches) return 0
    let total = 0
    for (const transactions of props.ruleMatches.values()) {
      total += transactions.length
    }
    return total
  })

  const uniqueCategories = computed(() => {
    const categories = new Set()
    props.newRules.forEach(rule => {
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
    
    props.newRules.forEach(rule => {
      console.log('rule', rule)
      const matchType = rule.match_type || rule.type || 'contains'
      if (counts.hasOwnProperty(matchType)) {
        counts[matchType]++
      } else {
        counts.contains++ // Default fallback
      }
    })
    
    return counts
  })

  // Direct use of shared functions with bound parameters
  const toggleExpanded = (rule) => sharedToggleExpanded(expandedRules, rule)
  const startEditing = (rule) => sharedStartEditing(editingRule, rule)
  const saveEdit = (rule, editData) => sharedSaveEdit(rule, editData, editingRule, emit)
  const cancelEdit = () => sharedCancelEdit(editingRule)
  const remove = (rule) => sharedDeleteRule(rule, emit)

  // Create rule from transaction
  function createRuleFromTransaction(transaction, rule) {
    createRuleTransaction.value = transaction
    createRuleData.value = {
      match_type: 'contains',
      pattern: transaction.name,
      category: rule?.category || '',
      labels: []
    }
    showCreateRuleDialog.value = true
  }

  function handleCreateRuleSave(ruleData) {
    try {
      console.log('handleCreateRuleSave: Creating rule in memory:', ruleData)
      
      // Create a rule object in memory (don't send to backend yet)
      const newRule = {
        id: `temp_rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...ruleData,
        priority: 1000, // High priority for user-created rules
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isTemporary: true // Flag to indicate this is not yet saved to backend
      }
      
      console.log('handleCreateRuleSave: Created rule in memory:', newRule)
      showCreateRuleDialog.value = false
      showSnackMessage('Rule created successfully')
      // Emit event to parent to track the new rule
      emit('rule-created', newRule)
    } catch (error) {
      console.error('Error creating rule:', error)
      showSnackMessage('Error creating rule: ' + error.message)
    }
  }

  function cancelCreateRule() {
    showCreateRuleDialog.value = false
    createRuleTransaction.value = null
    createRuleData.value = {
      match_type: 'contains',
      pattern: '',
      category: '',
      labels: []
    }
  }

  return {
    // State
    expandedRules,
    editingRule,
    showCreateRuleDialog,
    createRuleTransaction,
    createRuleData,
    showSnack,
    snackMessage,
    
    // Computed
    totalMatches,
    uniqueCategories,
    ruleTypeCounts,
    
    // Methods
    getCategoryName,
    showSnackMessage,
    toggleExpanded,
    startEditing,
    saveEdit,
    cancelEdit,
    remove,
    createRuleFromTransaction,
    handleCreateRuleSave,
    cancelCreateRule
  }
}