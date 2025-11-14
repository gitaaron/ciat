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
  emits: ['open-rule', 'categories-updated'],
  setup(props, { emit }) {
    // Reactive properties for filters and data
    const q = ref('')
    const start = ref('')
    const end = ref('')
    const category = ref('')
    const label = ref('')
    const account = ref('')
    const hideNetZero = ref(false)
    const inflowFilter = ref('both')
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
      { title: 'Category', key: 'category', sortable: false },
      { title: 'Labels', key: 'labels', sortable: false },
      { title: 'Explain', key: 'category_explain', sortable: false }
    ]

    // Track if dates have been initialized
    const datesInitialized = ref(false)
    // Store initial date values for reset functionality
    const initialStartDate = ref('')
    const initialEndDate = ref('')

    // Load transactions on component mount
    onMounted(async () => {
      // First, load all transactions without date filters to get the date range
      if (!datesInitialized.value) {
        await initializeDateRange()
        // After setting dates, the watch will automatically trigger loadTransactions()
      } else {
        // If dates are already initialized, load transactions directly
        await loadTransactions()
      }
    })

    async function initializeDateRange() {
      try {
        // Load all transactions without date filters to find min/max dates
        const allTransactions = await api.listTransactions({})
        
        if (allTransactions.length > 0) {
          // Find the earliest and latest dates
          const dates = allTransactions
            .map(tx => tx.date)
            .filter(date => date) // Filter out null/undefined dates
            .sort()
          
          if (dates.length > 0) {
            const earliestDate = dates[0]
            const latestDate = dates[dates.length - 1]
            
            // Set dates - the watch will automatically trigger loadTransactions()
            // We set datesInitialized first to prevent re-initialization
            datesInitialized.value = true
            start.value = earliestDate
            end.value = latestDate
            // Store initial values for reset functionality
            initialStartDate.value = earliestDate
            initialEndDate.value = latestDate
          }
        }
      } catch (error) {
        console.error('Error initializing date range:', error)
        // Continue with empty dates if there's an error
      }
    }

    // Watch for filter changes and reload data
    watch([q, start, end, category, label, account, hideNetZero, inflowFilter], async () => {
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
        if (label.value && label.value.trim()) params.label = label.value.trim()
        if (account.value) params.accountId = account.value

        const transactions = await api.listTransactions(params)
        
        // Apply hide net zero filter if enabled
        let filteredTransactions = transactions
        if (hideNetZero.value) {
          filteredTransactions = filterNetZeroPairs(transactions)
        }
        
        // Apply inflow/outflow filter
        if (inflowFilter.value !== 'both') {
          filteredTransactions = filteredTransactions.filter(tx => {
            const isInflow = tx.inflow === 1 || tx.inflow === true || tx.inflow === '1'
            if (inflowFilter.value === 'inflow') {
              return isInflow
            } else if (inflowFilter.value === 'outflow') {
              return !isInflow
            }
            return true
          })
        }
        
        rows.value = filteredTransactions
        // Store original states for change detection
        originalTransactions.value.clear()
        modifiedTransactions.value.clear()
        filteredTransactions.forEach(tx => {
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
          // Emit event to notify parent that categories were updated
          emit('categories-updated')
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

    function filterNetZeroPairs(transactions) {
      // Group transactions by absolute amount
      const amountGroups = new Map()
      
      transactions.forEach(tx => {
        const amount = Math.abs(parseFloat(tx.amount) || 0)
        if (!amountGroups.has(amount)) {
          amountGroups.set(amount, [])
        }
        amountGroups.get(amount).push(tx)
      })
      
      // Find pairs and mark them for exclusion
      const excludeIds = new Set()
      
      amountGroups.forEach((txs, amount) => {
        if (txs.length < 2) return
        
        // Separate inflows and outflows
        const inflows = txs.filter(tx => {
          const inflow = tx.inflow
          return inflow === 1 || inflow === true || inflow === '1'
        })
        const outflows = txs.filter(tx => {
          const inflow = tx.inflow
          return !(inflow === 1 || inflow === true || inflow === '1')
        })
        
        // Match pairs: one inflow and one outflow with same absolute amount
        const matchedPairs = []
        const usedInflows = new Set()
        const usedOutflows = new Set()
        
        inflows.forEach((inflowTx, i) => {
          if (usedInflows.has(i)) return
          
          outflows.forEach((outflowTx, j) => {
            if (usedOutflows.has(j)) return
            
            // Check if amounts match (considering sign)
            const inflowAmount = Math.abs(parseFloat(inflowTx.amount) || 0)
            const outflowAmount = Math.abs(parseFloat(outflowTx.amount) || 0)
            
            if (inflowAmount === outflowAmount && inflowAmount === amount) {
              matchedPairs.push([inflowTx, outflowTx])
              usedInflows.add(i)
              usedOutflows.add(j)
            }
          })
        })
        
        // Mark all matched pairs for exclusion
        matchedPairs.forEach(([inflowTx, outflowTx]) => {
          excludeIds.add(inflowTx.id)
          excludeIds.add(outflowTx.id)
        })
      })
      
      // Filter out excluded transactions
      return transactions.filter(tx => !excludeIds.has(tx.id))
    }

    function clearFilters() {
      q.value = ''
      // Reset dates to initial values instead of clearing them
      start.value = initialStartDate.value
      end.value = initialEndDate.value
      category.value = ''
      label.value = ''
      account.value = ''
      hideNetZero.value = false
      inflowFilter.value = 'both'
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
    const totalInflow = computed(() => 
      rows.value
        .filter(transaction => {
          const inflow = transaction.inflow
          return inflow === 1 || inflow === true || inflow === '1'
        })
        .reduce((sum, transaction) => sum + (transaction.amount || 0), 0)
    )
    const totalOutflow = computed(() => 
      rows.value
        .filter(transaction => {
          const inflow = transaction.inflow
          return !(inflow === 1 || inflow === true || inflow === '1')
        })
        .reduce((sum, transaction) => sum + (transaction.amount || 0), 0)
    )

    function setFilters(filters) {
      // Set filters programmatically
      if (filters.category !== undefined) {
        category.value = filters.category
      }
      if (filters.startDate !== undefined) {
        start.value = filters.startDate
      }
      if (filters.endDate !== undefined) {
        end.value = filters.endDate
      }
      // The watch will automatically trigger loadTransactions()
    }

    return {
      // Reactive properties
      q,
      start,
      end,
      category,
      label,
      account,
      hideNetZero,
      inflowFilter,
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
      totalInflow,
      totalOutflow,
      // Methods
      loadTransactions,
      getLabels,
      trackTransactionChange,
      saveAllChanges,
      clearFilters,
      handleTransactionNameClick,
      setFilters
    }
  }
}