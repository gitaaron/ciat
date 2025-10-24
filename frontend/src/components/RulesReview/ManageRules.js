import { ref, computed } from 'vue'
import { useRulesReview } from '../shared/RulesReviewMixin.js'

export default function ManageRulesJS(props, { emit }) {
  // Use shared rules review functionality
  const {
    getCategoryName,
    showSnackMessage,
    toggleExpanded: sharedToggleExpanded,
    startEditing: sharedStartEditing,
    saveEdit: sharedSaveEdit,
    cancelEdit: sharedCancelEdit,
    deleteRule: sharedDeleteRule
  } = useRulesReview()

  // State for each section - keeping them separate
  const expandedNewRules = ref(new Set())
  const editingNewRule = ref(null)
  const expandedExistingRules = ref(new Set())
  const editingExistingRule = ref(null)
  const expandedAutoRules = ref(new Set())
  const editingAutoRule = ref(null)
  
  // Create rule dialog state for each section
  const showCreateRuleDialogNew = ref(false)
  const createRuleTransactionNew = ref(null)
  const createRuleDataNew = ref({
    match_type: 'contains',
    pattern: '',
    category: '',
    labels: []
  })

  const showCreateRuleDialogExisting = ref(false)
  const createRuleTransactionExisting = ref(null)
  const createRuleDataExisting = ref({
    match_type: 'contains',
    pattern: '',
    category: '',
    labels: []
  })

  const showCreateRuleDialogAuto = ref(false)
  const createRuleTransactionAuto = ref(null)
  const createRuleDataAuto = ref({
    match_type: 'contains',
    pattern: '',
    category: '',
    labels: []
  })

  // Computed properties for each section
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
          transactions
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
  const toggleExpandedNew = (rule) => sharedToggleExpanded(expandedNewRules, rule)
  const startEditingNew = (rule) => sharedStartEditing(editingNewRule, rule)
  const saveEditNew = (rule, editData) => sharedSaveEdit(rule, editData, editingNewRule, emit)
  const cancelEditNew = () => sharedCancelEdit(editingNewRule)
  const removeNew = (rule) => sharedDeleteRule(rule, emit)

  // Existing Rules section functions
  const toggleExpandedExisting = (rule) => sharedToggleExpanded(expandedExistingRules, rule)
  const startEditingExisting = (rule) => sharedStartEditing(editingExistingRule, rule)
  const saveEditExisting = (rule, editData) => sharedSaveEdit(rule, editData, editingExistingRule, emit)
  const cancelEditExisting = () => sharedCancelEdit(editingExistingRule)
  const removeExisting = (rule) => sharedDeleteRule(rule, emit)

  // Auto Rules section functions
  const toggleExpandedAuto = (rule) => sharedToggleExpanded(expandedAutoRules, rule)
  const startEditingAuto = (rule) => sharedStartEditing(editingAutoRule, rule)
  const saveEditAuto = (rule, editData) => sharedSaveEdit(rule, editData, editingAutoRule, emit)
  const cancelEditAuto = () => sharedCancelEdit(editingAutoRule)
  const removeAuto = (rule) => sharedDeleteRule(rule, emit)

  // Create rule from transaction functions for each section
  function createRuleFromTransactionNew(transaction, rule) {
    createRuleTransactionNew.value = transaction
    createRuleDataNew.value = {
      match_type: 'contains',
      pattern: transaction.name,
      category: rule?.category || '',
      labels: []
    }
    showCreateRuleDialogNew.value = true
  }

  function createRuleFromTransactionExisting(transaction, rule) {
    createRuleTransactionExisting.value = transaction
    createRuleDataExisting.value = {
      match_type: 'contains',
      pattern: transaction.name,
      category: rule?.category || '',
      labels: []
    }
    showCreateRuleDialogExisting.value = true
  }

  function createRuleFromTransactionAuto(transaction, rule) {
    createRuleTransactionAuto.value = transaction
    createRuleDataAuto.value = {
      match_type: 'contains',
      pattern: transaction.name,
      category: rule.category,
      labels: []
    }
    showCreateRuleDialogAuto.value = true
  }

  // Handle create rule save for each section
  function handleCreateRuleSaveNew(ruleData) {
    try {
      const newRule = {
        id: `temp_rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...ruleData,
        priority: 1000,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isTemporary: true
      }
      
      showCreateRuleDialogNew.value = false
      showSnackMessage('Rule created successfully')
      emit('rule-created', newRule)
    } catch (error) {
      console.error('Error creating rule:', error)
      showSnackMessage('Error creating rule: ' + error.message)
    }
  }

  function handleCreateRuleSaveExisting(ruleData) {
    try {
      const newRule = {
        id: `temp_rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...ruleData,
        priority: 1000,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isTemporary: true
      }
      
      showCreateRuleDialogExisting.value = false
      showSnackMessage('Rule created successfully')
      emit('rule-created', newRule)
    } catch (error) {
      console.error('Error creating rule:', error)
      showSnackMessage('Error creating rule: ' + error.message)
    }
  }

  function handleCreateRuleSaveAuto(ruleData) {
    try {
      const newRule = {
        id: `temp_rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...ruleData,
        priority: 1000,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isTemporary: true
      }
      
      showCreateRuleDialogAuto.value = false
      showSnackMessage('Rule created successfully')
      emit('rule-created', newRule)
    } catch (error) {
      console.error('Error creating rule:', error)
      showSnackMessage('Error creating rule: ' + error.message)
    }
  }

  // Cancel create rule functions for each section
  function cancelCreateRuleNew() {
    showCreateRuleDialogNew.value = false
    createRuleTransactionNew.value = null
    createRuleDataNew.value = {
      match_type: 'contains',
      pattern: '',
      category: '',
      labels: []
    }
  }

  function cancelCreateRuleExisting() {
    showCreateRuleDialogExisting.value = false
    createRuleTransactionExisting.value = null
    createRuleDataExisting.value = {
      match_type: 'contains',
      pattern: '',
      category: '',
      labels: []
    }
  }

  function cancelCreateRuleAuto() {
    showCreateRuleDialogAuto.value = false
    createRuleTransactionAuto.value = null
    createRuleDataAuto.value = {
      match_type: 'contains',
      pattern: '',
      category: '',
      labels: []
    }
  }

  return {
    // State for each section
    expandedNewRules,
    editingNewRule,
    expandedExistingRules,
    editingExistingRule,
    expandedAutoRules,
    editingAutoRule,
    
    // Create rule dialog state for each section
    showCreateRuleDialogNew,
    createRuleTransactionNew,
    createRuleDataNew,
    showCreateRuleDialogExisting,
    createRuleTransactionExisting,
    createRuleDataExisting,
    showCreateRuleDialogAuto,
    createRuleTransactionAuto,
    createRuleDataAuto,
    
    // Computed properties
    existingRules,
    effectiveAutoRules,
    totalMatches,
    uniqueCategories,
    ruleTypeCounts,
    
    // Methods
    getCategoryName,
    showSnackMessage,
    
    // New Rules section methods
    toggleExpandedNew,
    startEditingNew,
    saveEditNew,
    cancelEditNew,
    removeNew,
    createRuleFromTransactionNew,
    handleCreateRuleSaveNew,
    cancelCreateRuleNew,
    
    // Existing Rules section methods
    toggleExpandedExisting,
    startEditingExisting,
    saveEditExisting,
    cancelEditExisting,
    removeExisting,
    createRuleFromTransactionExisting,
    handleCreateRuleSaveExisting,
    cancelCreateRuleExisting,
    
    // Auto Rules section methods
    toggleExpandedAuto,
    startEditingAuto,
    saveEditAuto,
    cancelEditAuto,
    removeAuto,
    createRuleFromTransactionAuto,
    handleCreateRuleSaveAuto,
    cancelCreateRuleAuto
  }
}
