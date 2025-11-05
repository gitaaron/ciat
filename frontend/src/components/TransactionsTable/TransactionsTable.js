import { ref, computed, onMounted, watch } from 'vue'
import api from '../api.js'
import { CATEGORY_OPTIONS, CATEGORY_SELECT_OPTIONS } from '../../config/categories.js'
import { showError, showSuccess } from '../../utils/notifications.js'
import { matchesRule } from '../../utils/ruleMatcher.js'
import TransactionFilters from '../shared/TransactionFilters.vue'
import TransactionStats from '../shared/TransactionStats.vue'
import TransactionTable from '../shared/TransactionTable.vue'

export default {
  name: 'TransactionsTable',
  components: {
    TransactionFilters,
    TransactionStats,
    TransactionTable
  },
  props: {
    accounts: {
      type: Array,
      default: () => []
    }
  },
  emits: ['open-rule'],
  setup(props, { emit }) {
    // Reactive properties for filters and data
    const q = ref('')
    const start = ref('')
    const end = ref('')
    const category = ref('')
    const label = ref('')
    const account = ref('')
    const rows = ref([])
    const loading = ref(false)
    const saving = ref(false)
    // Track original transaction states to detect changes
    const originalTransactions = ref(new Map()) // Map<id, originalTransaction>
    // Track modified transactions
    const modifiedTransactions = ref(new Map()) // Map<id, modifiedTransaction>

    // Table headers
    const tableHeaders = [
      { title: 'Date', key: 'date', sortable: true },
      { title: 'Account', key: 'account_name', sortable: true },
      { title: 'Name', key: 'name', sortable: true },
      { title: 'Description', key: 'description', sortable: true },
      { title: 'Amount', key: 'amount', sortable: true },
      { title: 'Type', key: 'inflow', sortable: true },
      { title: 'Category', key: 'category', sortable: false },
      { title: 'Labels', key: 'labels', sortable: false },
      { title: 'Explain', key: 'category_explain', sortable: false }
    ]

    // Load transactions on component mount
    onMounted(async () => {
      await loadTransactions()
    })

    // Watch for filter changes and reload data
    watch([q, start, end, category, label, account], async () => {
      await loadTransactions()
    })

    async function loadTransactions() {
      loading.value = true
      try {
        const params = {}
        if (q.value) params.q = q.value
        if (start.value) params.start = start.value
        if (end.value) params.end = end.value
        if (category.value) params.category = category.value
        if (label.value) params.label = label.value
        if (account.value) params.account = account.value

        const transactions = await api.listTransactions(params)
        rows.value = transactions
        // Store original states for change detection
        originalTransactions.value.clear()
        modifiedTransactions.value.clear()
        transactions.forEach(tx => {
          originalTransactions.value.set(tx.id, { ...tx })
        })
      } catch (error) {
        console.error('Error loading transactions:', error)
        rows.value = []
      } finally {
        loading.value = false
      }
    }

    function getLabels(item) {
      if (!item.labels) return []
      if (typeof item.labels === 'string') {
        try {
          return JSON.parse(item.labels)
        } catch {
          return item.labels.split(',').map(l => l.trim()).filter(l => l)
        }
      }
      return Array.isArray(item.labels) ? item.labels : []
    }

    function trackTransactionChange(item) {
      // Only track transactions with valid IDs
      if (!item.id) {
        console.warn('Cannot track change for transaction without ID:', item)
        return
      }
      
      const original = originalTransactions.value.get(item.id)
      if (!original) {
        console.warn('Original transaction not found for ID:', item.id)
        return
      }
      
      // Check if category changed
      const categoryChanged = original.category !== item.category
      
      if (categoryChanged) {
        // Store the modified transaction
        modifiedTransactions.value.set(item.id, { ...item })
      } else {
        // If reverted to original, remove from modified
        modifiedTransactions.value.delete(item.id)
      }
    }

    async function saveAllChanges() {
      if (modifiedTransactions.value.size === 0) return
      
      saving.value = true
      try {
        // Save all modified transactions
        const updates = Array.from(modifiedTransactions.value.values())
        const results = await Promise.allSettled(
          updates.map(tx => {
            if (!tx.id) {
              console.error('Transaction missing ID:', tx)
              return Promise.reject(new Error(`Transaction missing ID: ${tx.name || 'Unknown'}`))
            }
            return api.updateTransaction(tx.id, {
              category: tx.category
            })
          })
        )
        
        // Count successes and failures
        const succeeded = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected')
        
        if (failed.length > 0) {
          console.error('Some transactions failed to save:', failed)
          const errorMessages = failed.map((r, i) => {
            const tx = updates[i]
            return `${tx.name || 'Unknown'} (ID: ${tx.id}): ${r.reason?.message || 'Unknown error'}`
          })
          showError(`Failed to save ${failed.length} transaction${failed.length !== 1 ? 's' : ''}:\n${errorMessages.join('\n')}`)
        }
        
        // Clear modified transactions and reload
        modifiedTransactions.value.clear()
        await loadTransactions()
        
        if (succeeded > 0) {
          showSuccess(`Successfully saved ${succeeded} transaction${succeeded !== 1 ? 's' : ''}`)
        }
      } catch (error) {
        console.error('Error saving transactions:', error)
        showError('Error saving transactions: ' + error.message)
      } finally {
        saving.value = false
      }
    }

    // Computed property to check if there are unsaved changes
    const hasUnsavedChanges = computed(() => modifiedTransactions.value.size > 0)
    const modifiedTransactionsCount = computed(() => modifiedTransactions.value.size)

    function clearFilters() {
      q.value = ''
      start.value = ''
      end.value = ''
      category.value = ''
      label.value = ''
      account.value = ''
    }

    async function handleTransactionNameClick(transaction) {
      // Skip if manually overridden
      if (transaction.manual_override === 1 || transaction.manual_override === true) {
        return
      }

      try {
        // Load all rules
        const rules = await api.getRules()
        
        // Sort rules by priority (highest first), then by most recent
        const sortedRules = [...rules].sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority
          const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
          const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
          return bTime - aTime
        })

        // Find the first matching enabled rule
        for (const rule of sortedRules) {
          if (!rule.enabled) continue
          
          if (matchesRule(rule, transaction)) {
            // Found matching rule, emit event to open it
            emit('open-rule', rule)
            return
          }
        }

        // No matching rule found
        showError('No matching rule found for this transaction')
      } catch (error) {
        console.error('Error finding matching rule:', error)
        showError('Error finding matching rule: ' + error.message)
      }
    }

    // Computed properties for category and account options
    const categoryFilterOptions = computed(() => CATEGORY_OPTIONS)
    const categorySelectOptions = computed(() => CATEGORY_SELECT_OPTIONS)
    const accountOptions = computed(() => props.accounts.map(account => ({
      id: account.id,
      name: account.name
    })))

    // Computed properties for statistics
    const totalTransactions = computed(() => rows.value.length)
    const categorizedCount = computed(() => 
      rows.value.filter(transaction => transaction.category).length
    )
    const uncategorizedCount = computed(() => 
      rows.value.filter(transaction => !transaction.category).length
    )
    const totalAmount = computed(() => 
      rows.value.reduce((sum, transaction) => sum + (transaction.amount || 0), 0)
    )

    return {
      // Reactive properties
      q,
      start,
      end,
      category,
      label,
      account,
      rows,
      loading,
      saving,
      hasUnsavedChanges,
      modifiedTransactionsCount,
      // Computed properties
      categoryFilterOptions,
      categorySelectOptions,
      accountOptions,
      tableHeaders,
      totalTransactions,
      categorizedCount,
      uncategorizedCount,
      totalAmount,
      // Methods
      loadTransactions,
      getLabels,
      trackTransactionChange,
      saveAllChanges,
      clearFilters,
      handleTransactionNameClick
    }
  }
}