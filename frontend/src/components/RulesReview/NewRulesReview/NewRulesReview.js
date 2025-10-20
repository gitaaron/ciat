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

  // Computed properties
  const totalMatches = computed(() => {
    return props.newRules.reduce((total, rule) => {
      return total + (rule.transactions?.length || 0)
    }, 0)
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
    deleteRule
  }
}
