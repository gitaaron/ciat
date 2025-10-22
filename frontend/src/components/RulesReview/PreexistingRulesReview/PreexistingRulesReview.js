import { ref, computed } from 'vue'
import { useRulesReview } from '../../shared/RulesReviewMixin.js'

export default function PreexistingRulesReviewJS(props, { emit }) {
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
  const existingRules = computed(() => {
    if (!props.usedRules) return []
    
    return props.usedRules
      .map(rule => {
        // Use centralized rule matches instead of rule.transactions
        const transactions = props.ruleMatches.get(rule.id) || []
        return {
          ...rule,
          transactions
        }
      })
      .sort((a, b) => {
        // Sort by priority (higher first)
        if (a.priority !== b.priority) return b.priority - a.priority
        return 0
      })
  })

  // Wrapper functions that use the shared functionality
  function toggleExpanded(rule) {
    sharedToggleExpanded(expandedRules, rule)
  }

  function startEditing(rule) {
    sharedStartEditing(editingRule, rule)
  }

  async function saveEdit(rule, editData) {
    await sharedSaveEdit(rule, editData, editingRule, emit)
  }

  function cancelEdit() {
    sharedCancelEdit(editingRule)
  }

  async function deleteRule(rule) {
    await sharedDeleteRule(rule, emit)
  }

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
    existingRules,
    
    // Methods
    getCategoryName,
    showSnackMessage,
    toggleExpanded,
    startEditing,
    saveEdit,
    cancelEdit,
    deleteRule,
    createRuleFromTransaction,
    handleCreateRuleSave,
    cancelCreateRule
  }
}
