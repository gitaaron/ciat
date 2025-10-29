import { ref, computed } from 'vue'
import { getCategoryName } from '../../config/categories.js'
import { createRuleUtils } from './ruleUtils.js'

/**
 * Shared logic for RulesReview component
 */
export default function useRulesReviewLogic(props, { emit }) {
  // Common state
  const showSnack = ref(false)
  const snackMessage = ref('')

  // Get shared rule utilities
  const {
    showSnackMessage: sharedShowSnackMessage,
    toggleExpanded: sharedToggleExpanded,
    startEditing: sharedStartEditing,
    saveEdit: sharedSaveEdit,
    cancelEdit: sharedCancelEdit,
    deleteRule: sharedDeleteRule
  } = createRuleUtils()

  // Component-specific snackbar implementation
  function showSnackMessage(message) {
    snackMessage.value = message
    showSnack.value = true
  }

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
        hasChanges: true, // Flag to indicate this rule has changes to persist
        isNew: true // Flag to indicate this is a new rule (not edited existing)
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
    
    // Methods
    getCategoryName,
    showSnackMessage,
    toggleExpanded: (rule) => sharedToggleExpanded(expandedRules, rule),
    startEditing: (rule) => sharedStartEditing(editingRule, rule),
    saveEdit: (rule, editData) => sharedSaveEdit(rule, editData, editingRule, emit),
    cancelEdit: (rule) => sharedCancelEdit(editingRule, rule, emit),
    deleteRule: (rule) => sharedDeleteRule(rule, emit),
    createRuleFromTransaction,
    handleCreateRuleSave,
    cancelCreateRule
  }
}
