import api from '../api.js'
import { showError, showSuccess, showDeleteConfirm } from '../../utils/notifications.js'

/**
 * Shared utility functions for rule management
 */
export function createRuleUtils() {
  // Store original rule state for cancel functionality
  const originalRuleStates = new Map()

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
    // Store original state for potential revert
    originalRuleStates.set(rule.id, { ...rule })
    editingRule.value = rule.id
  }

  async function saveEdit(rule, editData, editingRule, emit) {
    try {
      // Show progress indicator
      emit('rule-save-start', { ruleId: rule.id })

      // Detect whether the edit affects matching (match_type or pattern change)
      const matchTypeChanged = Object.prototype.hasOwnProperty.call(editData, 'match_type') && editData.match_type !== rule.match_type
      const patternChanged = Object.prototype.hasOwnProperty.call(editData, 'pattern') && editData.pattern !== rule.pattern
      const matchChanged = !!(matchTypeChanged || patternChanged)

      // Apply edit data to rule object in-memory
      Object.assign(rule, editData)
      rule.hasChanges = true
      editingRule.value = null
      
      // Clear original state since save was successful
      originalRuleStates.delete(rule.id)
      
      showSnackMessage('Rule updated (changes will be saved when you continue to import)')

      // Inform parent about the edit details so it can decide whether to recompute
      emit('rule-edited', { ruleId: rule.id, matchChanged, updatedRule: rule })

      // Backward-compatible refresh event; parent may ignore for non-match edits
      emit('refresh-rules', { reason: 'edit', matchChanged, ruleId: rule.id })

      // Hide progress indicator
      emit('rule-save-end', { ruleId: rule.id })
    } catch (error) {
      console.error('Error updating rule:', error)
      showSnackMessage('Error updating rule: ' + error.message)
      // Hide progress indicator on error
      emit('rule-save-end', { ruleId: rule.id })
    }
  }

  function cancelEdit(editingRule, rule, emit) {
    const ruleId = rule.id
    const originalState = originalRuleStates.get(ruleId)
    
    if (originalState) {
      // Revert rule to original state
      Object.assign(rule, originalState)
      // Clear the original state since we're canceling
      originalRuleStates.delete(ruleId)
      
      // Emit event to parent to refresh UI with reverted state
      emit('rule-canceled', { ruleId, revertedRule: rule })
    }
    
    editingRule.value = null
  }

  async function deleteRule(rule, emit) {
    const confirmed = await showDeleteConfirm(
      `Are you sure you want to delete the rule "${rule.pattern}"?`,
      'Confirm Rule Deletion'
    )
    
    if (!confirmed) return

    try {
      const ruleId = rule.id
      
      await api.deleteRule(ruleId)
      showSuccess('Rule deleted successfully')
      // Emit refresh event to parent
      emit('refresh-rules')
    } catch (error) {
      console.error('Error deleting rule:', error)
      showError('Error deleting rule: ' + error.message)
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

