import { ref, computed, onMounted } from 'vue'
import api from '../api.js'
import MultiLabelSelector from '../MultiLabelSelector.vue'
import RuleItem from '../RuleItem.vue'
import CreateRuleDialog from '../shared/CreateRuleDialog.vue'
import { CATEGORY_STEPS, CATEGORY_NAMES } from '../../config/categories.js'
import { showError, showSuccess, showDeleteConfirm } from '../../utils/notifications.js'
import { applyRulesWithDetails } from '../../utils/ruleMatcher.js'

export default {
  name: 'RuleManager',
  components: {
    MultiLabelSelector,
    RuleItem,
    CreateRuleDialog
  },
  emits: ['create-new', 'rules-reapplied'],
  setup(props, { emit }) {
    const rules = ref([])
    const loading = ref(false)
    const reapplying = ref(false)
    const error = ref(null)
    const editingRule = ref(null)
    const editForm = ref({
      category: '',
      match_type: '',
      pattern: '',
      explain: '',
      labels: []
    })
    const saving = ref(false)
    const showEditDialog = ref(false)
    const searchPattern = ref('')
    const expandedRules = ref(new Set())
    const loadingTransactions = ref(new Set())
    const accounts = ref([])
    const ruleTransactions = ref(new Map()) // Map of ruleId -> transactions array
    const allTransactions = ref([]) // All transactions loaded from backend
    
    // Create rule dialog state
    const showCreateRuleDialog = ref(false)
    const createRuleTransaction = ref(null)
    const createRuleData = ref({
      match_type: 'contains',
      pattern: '',
      category: '',
      labels: []
    })
    const createRuleLoading = ref(false)

    const matchTypes = [
      { value: 'exact', label: 'Exact Match' },
      { value: 'contains', label: 'Contains' },
      { value: 'regex', label: 'Regular Expression' }
    ]

    const categorySteps = CATEGORY_STEPS
    const categoryStepNames = CATEGORY_STEPS.map(step => CATEGORY_NAMES[step])

    const sortedRules = computed(() => {
      return [...rules.value].sort((a, b) => {
        // First sort by priority (highest first)
        if (b.priority !== a.priority) return b.priority - a.priority;
        // If same priority, most recent wins
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
    });

    const filteredRules = computed(() => {
      if (!searchPattern.value || searchPattern.value.trim() === '') {
        return sortedRules.value;
      }
      const searchLower = searchPattern.value.toLowerCase().trim();
      return sortedRules.value.filter(rule => {
        const pattern = rule.pattern || '';
        return pattern.toLowerCase().includes(searchLower);
      });
    });

    async function loadAccounts() {
      try {
        accounts.value = await api.getAccounts()
      } catch (err) {
        console.error('Failed to load accounts:', err)
      }
    }

    async function loadAllTransactions() {
      try {
        // Load all transactions from backend (same as what Rules Review uses)
        const transactions = await api.listTransactions({})
        allTransactions.value = transactions || []
        console.log(`Loaded ${allTransactions.value.length} transactions for rule matching`)
        
        // If rules are already loaded, re-match them against the new transactions
        if (rules.value.length > 0) {
          await loadRules()
        }
      } catch (err) {
        console.error('Failed to load transactions:', err)
        allTransactions.value = []
      }
    }

    async function loadRules() {
      loading.value = true
      error.value = null
      
      try {
        const loadedRules = await api.getRules()
        
        // If we have transactions, match them against all rules using the same logic as Rules Review
        if (allTransactions.value.length > 0) {
          // Use applyRulesWithDetails to match all rules at once with proper priority handling
          const result = applyRulesWithDetails(allTransactions.value, loadedRules, { skipSort: false })
          
          // Update rules with their matching transactions
          rules.value = loadedRules.map(rule => {
            const matchingTransactions = result.ruleMatches.get(rule.id) || []
            ruleTransactions.value.set(rule.id, matchingTransactions)
            return {
              ...rule,
              transactions: matchingTransactions,
              actualMatches: matchingTransactions.length
            }
          })
        } else {
          // No transactions yet, just initialize rules
          rules.value = loadedRules.map(rule => ({
            ...rule,
            transactions: [],
            actualMatches: 0
          }))
        }
      } catch (err) {
        error.value = err.response?.data?.error || 'Failed to load rules'
      } finally {
        loading.value = false
      }
    }

    async function toggleExpanded(rule) {
      const ruleId = rule.id
      if (expandedRules.value.has(ruleId)) {
        expandedRules.value.delete(ruleId)
      } else {
        expandedRules.value.add(ruleId)
        // Transactions are already loaded via applyRulesWithDetails, no need to reload
        // Just ensure the rule has transactions attached
        if (!rule.transactions || rule.transactions.length === 0) {
          const matchingTransactions = ruleTransactions.value.get(ruleId) || []
          const ruleIndex = rules.value.findIndex(r => r.id === ruleId)
          if (ruleIndex !== -1) {
            rules.value[ruleIndex] = {
              ...rules.value[ruleIndex],
              transactions: matchingTransactions,
              actualMatches: matchingTransactions.length
            }
          }
        }
      }
    }

    function isExpanded(ruleId) {
      return expandedRules.value.has(ruleId)
    }

    function isEditing(ruleId) {
      return editingRule.value?.id === ruleId
    }

    // Helper function to ensure labels are always an array
    function ensureLabelsArray(labels) {
      if (!labels) return []
      if (Array.isArray(labels)) return labels
      if (typeof labels === 'string') {
        try {
          const parsed = JSON.parse(labels)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      }
      return []
    }

    // Handler for RuleItem edit event - opens the edit dialog
    function handleEditRule(rule) {
      editingRule.value = rule
      editForm.value = {
        category: rule.category,
        match_type: rule.match_type,
        pattern: rule.pattern,
        explain: rule.explain || '',
        labels: ensureLabelsArray(rule.labels)
      }
      showEditDialog.value = true
    }

    // Handler for RuleItem save-edit event - saves inline edit
    async function handleSaveEdit(rule, editData) {
      saving.value = true
      try {
        // For pattern rules, use pattern: prefix, for user rules use the id directly
        const ruleId = rule.type === 'pattern' 
          ? `pattern:${rule.id}` 
          : rule.id
        
        await api.updateRule(ruleId, editData)
        editingRule.value = null
        // Reload rules and refresh transactions (applyRulesWithDetails will re-match everything)
        await loadRules()
        showSuccess('Rule updated successfully')
      } catch (err) {
        console.error('Error updating rule:', err)
        error.value = 'Error updating rule: ' + err.message
        showError('Error updating rule: ' + err.message)
      } finally {
        saving.value = false
      }
    }

    // Handler for RuleItem cancel-edit event
    function handleCancelEdit(rule) {
      editingRule.value = null
    }

    // Legacy function for dialog-based editing (kept for backward compatibility)
    async function saveRule() {
      if (!editingRule.value) return
      
      saving.value = true
      try {
        // For pattern rules, use pattern: prefix, for user rules use the id directly
        const ruleId = editingRule.value.type === 'pattern' 
          ? `pattern:${editingRule.value.id}` 
          : editingRule.value.id
        
        await api.updateRule(ruleId, editForm.value)
        showEditDialog.value = false
        editingRule.value = null
        await loadRules()
      } catch (err) {
        console.error('Error updating rule:', err)
        error.value = 'Error updating rule: ' + err.message
      } finally {
        saving.value = false
      }
    }

    function cancelEdit() {
      editingRule.value = null
      showEditDialog.value = false
      editForm.value = {
        category: '',
        match_type: '',
        pattern: '',
        explain: '',
        labels: []
      }
    }

    async function toggleRule(rule) {
      try {
        // For pattern rules, use pattern: prefix, for user rules use the id directly
        const ruleId = rule.type === 'pattern' 
          ? `pattern:${rule.id}` 
          : rule.id
        
        await api.toggleRule(ruleId, !rule.enabled)
        await loadRules()
      } catch (err) {
        error.value = err.response?.data?.error || 'Failed to toggle rule'
      }
    }

    async function deleteRule(rule) {
      const confirmed = await showDeleteConfirm(
        `Are you sure you want to delete this rule?\n\nPattern: ${rule.pattern}\nCategory: ${rule.category}`,
        'Confirm Rule Deletion'
      )
      
      if (!confirmed) return
      
      try {
        await api.deleteRule(rule.id)
        await loadRules()
      } catch (err) {
        error.value = err.response?.data?.error || 'Failed to delete rule'
      }
    }

    async function refreshRules() {
      await loadAllTransactions()
      await loadRules()
    }

    async function reapplyRules() {
      reapplying.value = true
      error.value = null
      
      try {
        const result = await api.reapplyRules()
        showSuccess(
          `Reapplied rules to ${result.updated || 0} transactions` +
          (result.changed ? ` (${result.changed} category changes)` : '') +
          ` out of ${result.total || 0} total.`
        )
        await loadRules()
        // Emit event to notify parent that rules were reapplied
        emit('rules-reapplied', result)
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Failed to reapply rules'
        error.value = errorMsg
        showError(errorMsg)
      } finally {
        reapplying.value = false
      }
    }

    function formatDate(dateString) {
      if (!dateString) return 'Unknown'
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Unknown'
      return date.toLocaleDateString()
    }

    function getItemKey(item) {
      // Use the id if it exists, otherwise create a unique key from pattern and category
      return item.id || `${item.pattern}_${item.category}_${item.priority}`
    }

    // Create rule from transaction
    function handleCreateRule(transaction, rule) {
      createRuleTransaction.value = transaction
      createRuleData.value = {
        match_type: 'contains',
        pattern: transaction.name,
        category: rule?.category || transaction.category || '',
        labels: []
      }
      showCreateRuleDialog.value = true
    }

    async function handleCreateRuleSave(ruleData) {
      createRuleLoading.value = true
      try {
        // Create the rule via API
        const newRule = await api.createRule(ruleData)
        showSuccess('Rule created successfully')
        showCreateRuleDialog.value = false
        createRuleTransaction.value = null
        createRuleData.value = {
          match_type: 'contains',
          pattern: '',
          category: '',
          labels: []
        }
        
        // Reload rules and transactions to include the new rule
        await loadRules()
      } catch (err) {
        console.error('Error creating rule:', err)
        showError('Error creating rule: ' + (err.response?.data?.error || err.message))
      } finally {
        createRuleLoading.value = false
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

    onMounted(async () => {
      await loadAccounts()
      await loadAllTransactions()
      await loadRules()
    })

    return {
      rules,
      loading,
      reapplying,
      error,
      editingRule,
      editForm,
      saving,
      showEditDialog,
      searchPattern,
      matchTypes,
      categorySteps,
      categoryStepNames,
      sortedRules,
      filteredRules,
      expandedRules,
      accounts,
      ruleTransactions,
      loadingTransactions,
      allTransactions,
      showCreateRuleDialog,
      createRuleTransaction,
      createRuleData,
      createRuleLoading,
      loadRules,
      loadAccounts,
      loadAllTransactions,
      editRule: handleEditRule,
      saveRule,
      cancelEdit,
      handleSaveEdit,
      handleCancelEdit,
      toggleRule,
      deleteRule,
      refreshRules,
      reapplyRules,
      toggleExpanded,
      isExpanded,
      isEditing,
      handleCreateRule,
      handleCreateRuleSave,
      cancelCreateRule,
      formatDate,
      getItemKey
    }
  }
}
