import api from '../api.js'

/**
 * Shared utility functions for rule management
 */
export function createRuleUtils() {
  // Helper functions
  function showSnackMessage(message) {
    console.log('Snack message:', message)
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
    showSnackMessage,
    toggleExpanded,
    startEditing,
    saveEdit,
    cancelEdit,
    deleteRule
  }
}
