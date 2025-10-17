import { ref, computed, watch } from 'vue'
import api from '../api.js'
import MultiLabelSelector from '../MultiLabelSelector.vue'
import RuleItem from './RuleItem.vue'

export default {
  name: 'CombinedRulesReview',
  components: {
    MultiLabelSelector,
    RuleItem
  },
  props: {
    usedRules: Array,
    autoRules: Object,
    transactions: Array,
    accounts: Array
  },
  emits: ['commit'],
  setup(props, { emit }) {
    // Existing rules state
    const expandedRules = ref(new Set())
    const editingRule = ref(null)

    // Auto rules state
    const expandedAutoRules = ref(new Set())
    const editingAutoRule = ref(null)
    const applying = ref(false)
    const ruleFrequencies = ref(new Map())
    const ruleExplanations = ref(new Map())
    const rulePreviewCounts = ref(new Map())
    const ruleMatches = ref(new Map())

    // Create rule dialog state
    const showCreateRuleDialog = ref(false)
    const createRuleTransaction = ref(null)
    const createRuleData = ref({
      type: 'contains',
      pattern: '',
      category: '',
      labels: []
    })

    // Snack message state
    const showSnack = ref(false)
    const snackMessage = ref('')

    // Computed properties
    const existingRules = computed(() => {
      if (!props.usedRules) return []
      
      return props.usedRules
        .filter(rule => rule.type === 'user_rule' || rule.type === 'pattern')
        .sort((a, b) => {
          // Sort by priority (higher first), then by type (user rules first)
          if (a.priority !== b.priority) return b.priority - a.priority
          if (a.type !== b.type) return a.type === 'user_rule' ? -1 : 1
          return 0
        })
    })

    const effectiveAutoRules = computed(() => {
      if (!props.autoRules || !props.autoRules.rules) return []
      return props.autoRules.rules
        .filter(rule => !rule.applied)
        .map(rule => ({
          ...rule,
          transactions: ruleMatches.value.get(rule.id) || []
        }))
    })

    // Helper functions
    function getCategoryName(category) {
      const categoryNames = {
        'fixed_costs': 'Fixed Costs',
        'investments': 'Investments',
        'guilt_free': 'Guilt Free',
        'short_term_savings': 'Short Term Savings',
        '': 'Uncategorized'
      }
      return categoryNames[category] || category
    }

    function getAccountName(accountId) {
      const account = props.accounts.find(a => a.id === accountId)
      return account ? account.name : 'Unknown Account'
    }

    function formatAmount(amount) {
      if (amount === null || amount === undefined || isNaN(amount)) return '$0.00'
      return `$${Number(amount).toFixed(2)}`
    }

    function formatDate(dateString) {
      if (!dateString) return 'Unknown'
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Unknown'
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }

    // Existing rules functions
    function toggleExpanded(rule) {
      const ruleId = rule.id || rule.pattern
      if (expandedRules.value.has(ruleId)) {
        expandedRules.value.delete(ruleId)
      } else {
        expandedRules.value.add(ruleId)
      }
    }

    function startEditing(rule) {
      editingRule.value = rule.id
    }

    async function saveEdit(rule, editData) {
      try {
        await api.updateRule(rule.id, editData)
        editingRule.value = null
        showSnackMessage('Rule updated successfully')
        // Emit refresh event to parent
        emit('refresh-rules')
      } catch (error) {
        console.error('Error updating rule:', error)
        showSnackMessage('Error updating rule: ' + error.message)
      }
    }

    function cancelEdit() {
      editingRule.value = null
    }

    async function deleteRule(rule) {
      if (!confirm(`Are you sure you want to delete the rule "${rule.pattern}"?`)) {
        return
      }

      try {
        const ruleId = rule.type === 'pattern' 
          ? `pattern:${rule.id}` 
          : rule.id
        
        await api.deleteRule(ruleId)
        showSnackMessage('Rule deleted successfully')
        // Emit refresh event to parent
        emit('refresh-rules')
      } catch (error) {
        console.error('Error deleting rule:', error)
        showSnackMessage('Error deleting rule: ' + error.message)
      }
    }

    // Auto rules functions
    function toggleAutoRuleExpanded(rule) {
      const ruleId = rule.id
      if (expandedAutoRules.value.has(ruleId)) {
        expandedAutoRules.value.delete(ruleId)
      } else {
        expandedAutoRules.value.add(ruleId)
        loadRuleMatches(ruleId)
      }
    }

    function startEditingAutoRule(rule) {
      editingAutoRule.value = rule.id
    }

    async function saveAutoRuleEdit(rule, editData) {
      try {
        // For auto rules, we need to create a new rule
        await api.createRule(editData)
        editingAutoRule.value = null
        showSnackMessage('Rule created successfully')
        // Remove from auto rules list
        removeAutoRule(rule.id)
      } catch (error) {
        console.error('Error creating rule:', error)
        showSnackMessage('Error creating rule: ' + error.message)
      }
    }

    function cancelAutoRuleEdit() {
      editingAutoRule.value = null
    }

    function removeAutoRule(rule) {
      // Remove from auto rules list (this is just UI state)
      const ruleIndex = props.autoRules.rules.findIndex(r => r.id === rule.id)
      if (ruleIndex !== -1) {
        props.autoRules.rules.splice(ruleIndex, 1)
      }
    }

    async function applySingleRule(rule) {
      applying.value = true
      try {
        await api.createRule({
          match_type: rule.type,
          pattern: rule.pattern,
          category: rule.category,
          explain: rule.explain,
          labels: rule.labels || []
        })
        
        // Mark as applied
        rule.applied = true
        showSnackMessage('Rule applied successfully')
      } catch (error) {
        console.error('Error applying rule:', error)
        showSnackMessage('Error applying rule: ' + error.message)
      } finally {
        applying.value = false
      }
    }

    async function applyAllAutoRules() {
      applying.value = true
      try {
        const rulesToApply = effectiveAutoRules.value.filter(rule => !rule.applied)
        
        if (rulesToApply.length === 0) {
          showSnackMessage('No auto-generated rules to apply')
          return
        }

        let successCount = 0
        let errorCount = 0

        for (const rule of rulesToApply) {
          try {
            await api.createRule({
              match_type: rule.type,
              pattern: rule.pattern,
              category: rule.category,
              explain: rule.explain,
              labels: rule.labels || []
            })
            
            // Mark as applied
            rule.applied = true
            successCount++
          } catch (error) {
            console.error('Error applying rule:', error)
            errorCount++
          }
        }

        if (successCount > 0) {
          showSnackMessage(`Successfully applied ${successCount} auto-generated rules`)
        }
        if (errorCount > 0) {
          showSnackMessage(`Failed to apply ${errorCount} rules`)
        }
      } catch (error) {
        console.error('Error applying auto rules:', error)
        showSnackMessage('Error applying auto rules: ' + error.message)
      } finally {
        applying.value = false
      }
    }

    async function loadRuleMatches(ruleId) {
      if (ruleMatches.value.has(ruleId)) return

      try {
        // Find the rule to get its pattern and match type
        const rule = props.autoRules?.rules?.find(r => r.id === ruleId)
        if (!rule || !props.transactions) {
          ruleMatches.value.set(ruleId, [])
          rulePreviewCounts.value.set(ruleId, 0)
          return
        }

        // Filter transactions based on rule pattern and match type
        let matches = []
        const pattern = rule.pattern?.toLowerCase() || ''
        const matchType = rule.type || 'contains'

        matches = props.transactions.filter(tx => {
          const merchantName = tx.name?.toLowerCase() || ''
          
          switch (matchType) {
            case 'contains':
              return merchantName.includes(pattern)
            case 'exact':
              return merchantName === pattern
            case 'regex':
              try {
                const regex = new RegExp(pattern, 'i')
                return regex.test(merchantName)
              } catch (e) {
                return false
              }
            case 'mcc':
              return tx.mcc === pattern
            default:
              return merchantName.includes(pattern)
          }
        })

        // Limit to reasonable number for performance
        const limitedMatches = matches.slice(0, 50)
        
        ruleMatches.value.set(ruleId, limitedMatches)
        rulePreviewCounts.value.set(ruleId, limitedMatches.length)
      } catch (error) {
        console.error('Error loading rule matches:', error)
        ruleMatches.value.set(ruleId, [])
        rulePreviewCounts.value.set(ruleId, 0)
      }
    }

    function getPreviewCount(ruleId) {
      return rulePreviewCounts.value.get(ruleId) || 0
    }

    function getPreviewMatches(ruleId) {
      return (ruleMatches.value.get(ruleId) || []).slice(0, 3)
    }

    function getExistingRulePreviewCount(ruleId) {
      const rule = props.usedRules?.find(r => (r.id || r.pattern) === ruleId)
      return rule?.transactions?.length || 0
    }

    function getExistingRulePreviewMatches(ruleId) {
      const rule = props.usedRules?.find(r => (r.id || r.pattern) === ruleId)
      return (rule?.transactions || []).slice(0, 3)
    }

    function getExistingRuleSingleMatch(ruleId) {
      const rule = props.usedRules?.find(r => (r.id || r.pattern) === ruleId)
      return (rule?.transactions || []).slice(0, 1)
    }

    function getSinglePreviewMatch(ruleId) {
      return (ruleMatches.value.get(ruleId) || []).slice(0, 1)
    }

    // Create rule from transaction
    function createRuleFromTransaction(transaction, rule) {
      createRuleTransaction.value = transaction
      createRuleData.value = {
        type: 'contains',
        pattern: transaction.name,
        category: rule.category,
        labels: []
      }
      showCreateRuleDialog.value = true
    }

    async function saveNewRule() {
      try {
        await api.createRule(createRuleData.value)
        showCreateRuleDialog.value = false
        showSnackMessage('Rule created successfully')
      } catch (error) {
        console.error('Error creating rule:', error)
        showSnackMessage('Error creating rule: ' + error.message)
      }
    }

    function cancelCreateRule() {
      showCreateRuleDialog.value = false
      createRuleTransaction.value = null
      createRuleData.value = {
        type: 'contains',
        pattern: '',
        category: '',
        labels: []
      }
    }

    function showSnackMessage(message) {
      snackMessage.value = message
      showSnack.value = true
      setTimeout(() => {
        showSnack.value = false
      }, 3000)
    }

    async function handleCommit() {
      // Apply all auto-generated rules first
      await applyAllAutoRules()
      
      // Then emit the commit event
      emit('commit')
    }

    // Initialize rule frequencies and explanations
    function initializeRuleData() {
      if (props.autoRules && props.autoRules.rules) {
        props.autoRules.rules.forEach(rule => {
          ruleFrequencies.value.set(rule.id, rule.frequency || 0)
          ruleExplanations.value.set(rule.id, rule.explain || '')
          // Load transaction matches for auto rules
          loadRuleMatches(rule.id)
        })
      }
    }

    // Watch for changes in autoRules and initialize data
    watch(() => props.autoRules, () => {
      initializeRuleData()
    }, { immediate: true })

    return {
      // State
      expandedRules,
      editingRule,
      expandedAutoRules,
      editingAutoRule,
      applying,
      ruleFrequencies,
      ruleExplanations,
      rulePreviewCounts,
      ruleMatches,
      showCreateRuleDialog,
      createRuleTransaction,
      createRuleData,
      showSnack,
      snackMessage,
      
      // Computed
      existingRules,
      effectiveAutoRules,
      
      // Methods
      getCategoryName,
      getAccountName,
      formatAmount,
      formatDate,
      toggleExpanded,
      startEditing,
      saveEdit,
      cancelEdit,
      deleteRule,
      toggleAutoRuleExpanded,
      startEditingAutoRule,
      saveAutoRuleEdit,
      cancelAutoRuleEdit,
      removeAutoRule,
      applyAllAutoRules,
      loadRuleMatches,
      getPreviewCount,
      getPreviewMatches,
      getExistingRulePreviewCount,
      getExistingRulePreviewMatches,
      getExistingRuleSingleMatch,
      getSinglePreviewMatch,
      createRuleFromTransaction,
      saveNewRule,
      cancelCreateRule,
      showSnackMessage,
      handleCommit,
      initializeRuleData
    }
  }
}
