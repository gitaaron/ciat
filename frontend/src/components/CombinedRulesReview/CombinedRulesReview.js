import { ref, computed, watch } from 'vue'
import api from '../api.js'
import MultiLabelSelector from '../MultiLabelSelector.vue'
import RuleItem from './RuleItem.vue'
import { matchesRule, applyRulesToTransactions, getUnmatchedTransactions, applyRulesWithDetails } from '../../utils/ruleMatcher.js'
import { useRulesReview } from '../shared/RulesReviewMixin.js'

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

    const effectiveAutoRules = computed(() => {
      if (!props.autoRules || !props.autoRules.rules) return []
      const rules = props.autoRules.rules
        .filter(rule => !rule.applied)
        .map(rule => {
          const transactions = ruleMatches.value.get(rule.id) || []
          const hasInMap = ruleMatches.value.has(rule.id)
          console.log(`effectiveAutoRules: Rule ${rule.id} (${rule.pattern}) has ${transactions.length} transactions, exists in map: ${hasInMap}`)
          return {
            ...rule,
            transactions
          }
        })
      
      console.log('effectiveAutoRules: Total rules with transactions:', rules.length)
      return rules
    })

    // Helper functions (getCategoryName is now provided by shared mixin)

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

    // Existing rules functions (using shared functionality)
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

    // Auto rules functions
    function toggleAutoRuleExpanded(rule) {
      const ruleId = rule.id
      if (expandedAutoRules.value.has(ruleId)) {
        expandedAutoRules.value.delete(ruleId)
      } else {
        expandedAutoRules.value.add(ruleId)
        // Load all rule matches to ensure proper priority handling
        loadAllRuleMatches()
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

    function loadRuleMatches(ruleId, unmatchedTransactions) {
      if (ruleMatches.value.has(ruleId)) return

      try {
        // Find the rule to get its pattern and match type
        const rule = props.autoRules?.rules?.find(r => r.id === ruleId)
        if (!rule || !unmatchedTransactions) {
          ruleMatches.value.set(ruleId, [])
          rulePreviewCounts.value.set(ruleId, 0)
          return
        }

        // Use the same rule matching logic as the main matching function
        const matches = unmatchedTransactions.filter(tx => matchesRule(rule, tx))

        // Store matches
        ruleMatches.value.set(ruleId, matches)
        rulePreviewCounts.value.set(ruleId, matches.length)
      } catch (error) {
        console.error('Error loading rule matches:', error)
        ruleMatches.value.set(ruleId, [])
        rulePreviewCounts.value.set(ruleId, 0)
      }
    }

    function loadAllRuleMatches() {
      console.log('loadAllRuleMatches: FUNCTION CALLED - Starting execution')
      if (!props.autoRules?.rules || !props.transactions) {
        console.log('loadAllRuleMatches: Missing autoRules or transactions', {
          hasAutoRules: !!props.autoRules?.rules,
          hasTransactions: !!props.transactions,
          autoRulesCount: props.autoRules?.rules?.length || 0,
          transactionsCount: props.transactions?.length || 0
        })
        return
      }

      // Get all auto rules sorted by priority (highest first)
      const allAutoRules = props.autoRules.rules
        .filter(r => !r.applied)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))

      console.log('loadAllRuleMatches: Processing auto rules', {
        totalAutoRules: props.autoRules.rules.length,
        unappliedAutoRules: allAutoRules.length,
        sampleRule: allAutoRules[0],
        transactionsCount: props.transactions.length
      })

      // Start with all transactions (they are raw transactions from ImportWizard)
      const unmatchedTransactions = props.transactions

      // Use the centralized rule matching logic
      console.log('loadAllRuleMatches: About to call applyRulesWithDetails')
      const result = applyRulesWithDetails(unmatchedTransactions, allAutoRules)
      console.log('loadAllRuleMatches: applyRulesWithDetails completed')
      
      console.log('loadAllRuleMatches: Rule matching result', {
        ruleMatchesCount: result.ruleMatches.size,
        categorizedTransactionsCount: result.categorizedTransactions.length,
        sampleMatches: Array.from(result.ruleMatches.entries()).slice(0, 3)
      })
      
      // Store the rule matches for preview
      console.log('loadAllRuleMatches: Storing rule matches')
      for (const [ruleId, matchingTransactions] of result.ruleMatches) {
        console.log(`loadAllRuleMatches: Storing rule ${ruleId} with ${matchingTransactions.length} transactions`)
        ruleMatches.value.set(ruleId, matchingTransactions)
        rulePreviewCounts.value.set(ruleId, matchingTransactions.length)
      }
      
      console.log('loadAllRuleMatches: Final ruleMatches map size:', ruleMatches.value.size)
      console.log('loadAllRuleMatches: Sample ruleMatches keys:', Array.from(ruleMatches.value.keys()).slice(0, 5))
    }

    function getPreviewCount(ruleId) {
      return rulePreviewCounts.value.get(ruleId) || 0
    }

    function getPreviewMatches(ruleId) {
      return (ruleMatches.value.get(ruleId) || []).slice(0, 3)
    }

    function getExistingRulePreviewCount(ruleId) {
      const rule = props.usedRules?.find(r => r.id === ruleId)
      return rule?.transactions?.length || 0
    }

    function getExistingRulePreviewMatches(ruleId) {
      const rule = props.usedRules?.find(r => r.id === ruleId)
      return (rule?.transactions || []).slice(0, 3)
    }

    function getExistingRuleSingleMatch(ruleId) {
      const rule = props.usedRules?.find(r => r.id === ruleId)
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

    // showSnackMessage is now provided by the shared mixin

    async function handleCommit() {
      // Apply all auto-generated rules first
      await applyAllAutoRules()
      
      // Then emit the commit event
      emit('commit')
    }

    // Initialize rule frequencies and explanations
    function initializeRuleData() {
      console.log('initializeRuleData: Called with autoRules:', !!props.autoRules)
      if (props.autoRules && props.autoRules.rules) {
        console.log('initializeRuleData: Processing', props.autoRules.rules.length, 'rules')
        props.autoRules.rules.forEach(rule => {
          ruleFrequencies.value.set(rule.id, rule.frequency || 0)
          ruleExplanations.value.set(rule.id, rule.explain || '')
        })
        
        // Load all rule matches to ensure proper priority handling
        console.log('initializeRuleData: Calling loadAllRuleMatches')
        loadAllRuleMatches()
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
      loadAllRuleMatches,
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
