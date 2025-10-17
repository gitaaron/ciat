import { ref, computed } from 'vue'
import { useRulesReview } from '../shared/RulesReviewMixin.js'

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

  // Computed properties
  const existingRules = computed(() => {
    if (!props.usedRules) return []
    
    return props.usedRules
      .filter(rule => rule.type === 'user_rule')
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

  return {
    // State
    expandedRules,
    editingRule,
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
    deleteRule
  }
}
