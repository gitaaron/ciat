import { ref } from 'vue'
import api from '../api.js'

/**
 * Shared functionality for rules review components
 * Provides common rule management functions
 */
export function useRulesReview() {
  // Common state
  const showSnack = ref(false)
  const snackMessage = ref('')

  // Helper functions
  function getCategoryName(category) {
    const categoryNames = {
      'fixed_costs': 'Fixed Costs',
      'investments': 'Investments', 
      'guilt_free': 'Guilt Free',
      'short_term_savings': 'Short Term Savings'
    }
    return categoryNames[category] || category
  }

  function showSnackMessage(message) {
    snackMessage.value = message
    showSnack.value = true
  }

  // Rule management functions
  function toggleExpanded(expandedRules, rule) {
    const ruleId = rule.id
    if (expandedRules.value.has(ruleId)) {
      expandedRules.value.delete(ruleId)
    } else {
      expandedRules.value.add(ruleId)
    }
  }

  function startEditing(editingRule, rule) {
    editingRule.value = rule.id
  }

  async function saveEdit(rule, editData, editingRule, emit) {
    try {
      // Apply edit data to rule object in-memory
      Object.assign(rule, editData)
      rule.hasChanges = true
      editingRule.value = null
      showSnackMessage('Rule updated (changes will be saved when you continue to import)')
      // Emit refresh event to parent to trigger rule match recomputation
      emit('refresh-rules')
    } catch (error) {
      console.error('Error updating rule:', error)
      showSnackMessage('Error updating rule: ' + error.message)
    }
  }

  function cancelEdit(editingRule) {
    editingRule.value = null
  }

  async function deleteRule(rule, emit) {
    if (!confirm(`Are you sure you want to delete the rule "${rule.pattern}"?`)) {
      return
    }

    try {
      const ruleId = rule.id
      
      await api.deleteRule(ruleId)
      showSnackMessage('Rule deleted successfully')
      // Emit refresh event to parent
      emit('refresh-rules')
    } catch (error) {
      console.error('Error deleting rule:', error)
      showSnackMessage('Error deleting rule: ' + error.message)
    }
  }

  return {
    // State
    showSnack,
    snackMessage,
    
    // Methods
    getCategoryName,
    showSnackMessage,
    toggleExpanded,
    startEditing,
    saveEdit,
    cancelEdit,
    deleteRule
  }
}

