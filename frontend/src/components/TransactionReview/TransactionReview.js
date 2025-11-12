import { ref, computed, watch } from 'vue'
import { CATEGORY_OPTIONS, CATEGORY_SELECT_OPTIONS, getCategoryName, getCategoryIcon, getCategoryColor } from '../../config/categories.js'

export default {
  name: 'TransactionReview',
  props: {
    previewsByAccount: {
      type: Map,
      required: true
    },
    accounts: {
      type: Array,
      default: () => []
    },
    processing: {
      type: Boolean,
      default: false
    }
  },
  emits: ['back-to-rules', 'import-transactions', 'save-and-import', 'transaction-updated'],
  setup(props, { emit }) {
    // Search and filter state
    const searchQuery = ref('')
    const selectedCategory = ref('')
    const selectedAccount = ref('')
    const uncategorizedExpanded = ref(false)
    
    // Category expansion state
    const expandedCategories = ref(new Set())

    // Table headers
    const transactionHeaders = [
      { title: 'Date', key: 'date', sortable: true },
      { title: 'Account', key: 'account_name', sortable: true },
      { title: 'Name', key: 'name', sortable: true },
      { title: 'Amount', key: 'amount', sortable: true },
      { title: 'Category', key: 'category', sortable: false },
      { title: 'Labels', key: 'labels', sortable: false }
    ]

    // Category options for filter
    const categoryOptions = computed(() => CATEGORY_OPTIONS)

    // Account options for filter
    const accountOptions = computed(() => {
      const accounts = []
      for (const [accountId, transactions] of props.previewsByAccount) {
        const account = props.accounts.find(a => a.id === accountId)
        if (account) {
          accounts.push({ id: accountId, name: account.name })
        }
      }
      return accounts
    })

    // Get all transactions from all accounts
    const allTransactions = computed(() => {
      const transactions = []
      for (const [accountId, accountTransactions] of props.previewsByAccount) {
        const account = props.accounts.find(a => a.id === accountId)
        const accountName = account ? account.name : 'Unknown Account'
        
        accountTransactions.forEach(transaction => {
          transactions.push({
            ...transaction,
            account_name: accountName,
            account_id: accountId
          })
        })
      }
      return transactions
    })

    // Filter transactions based on search and filters
    const filteredTransactions = computed(() => {
      let filtered = allTransactions.value

      // Apply search filter
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(transaction => 
          transaction.name.toLowerCase().includes(query) ||
          (transaction.description && transaction.description.toLowerCase().includes(query)) ||
          transaction.amount.toString().includes(query)
        )
      }

      // Apply category filter
      if (selectedCategory.value) {
        if (selectedCategory.value === 'uncategorized') {
          filtered = filtered.filter(transaction => !transaction.category)
        } else {
          filtered = filtered.filter(transaction => transaction.category === selectedCategory.value)
        }
      }

      // Apply account filter
      if (selectedAccount.value) {
        filtered = filtered.filter(transaction => transaction.account_id === selectedAccount.value)
      }

      return filtered
    })

    // Separate categorized and uncategorized transactions
    const categorizedTransactions = computed(() => 
      filteredTransactions.value.filter(transaction => transaction.category)
    )
    
    const uncategorizedTransactions = computed(() => 
      filteredTransactions.value.filter(transaction => !transaction.category)
    )

    // Group categorized transactions by category
    const categoryGroups = computed(() => {
      const groups = new Map()
      
      categorizedTransactions.value.forEach(transaction => {
        const category = transaction.category
        if (!groups.has(category)) {
          groups.set(category, {
            name: category,
            transactions: [],
            totalAmount: 0,
            expanded: expandedCategories.value.has(category)
          })
        }
        
        const group = groups.get(category)
        group.transactions.push(transaction)
        group.totalAmount += transaction.amount
      })

      // Sort transactions within each group by date
      for (const group of groups.values()) {
        group.transactions.sort((a, b) => new Date(a.date) - new Date(b.date))
      }

      // Convert to array and sort by category name
      return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name))
    })

    // Statistics
    const totalTransactions = computed(() => filteredTransactions.value.length)
    const categorizedCount = computed(() => categorizedTransactions.value.length)
    const uncategorizedCount = computed(() => uncategorizedTransactions.value.length)
    
    const totalInflow = computed(() => 
      filteredTransactions.value
        .filter(transaction => {
          const inflow = transaction.inflow
          return inflow === 1 || inflow === true || inflow === '1'
        })
        .reduce((sum, transaction) => sum + (transaction.amount || 0), 0)
    )
    const totalOutflow = computed(() => 
      filteredTransactions.value
        .filter(transaction => {
          const inflow = transaction.inflow
          return !(inflow === 1 || inflow === true || inflow === '1')
        })
        .reduce((sum, transaction) => sum + (transaction.amount || 0), 0)
    )
    
    const uncategorizedTotal = computed(() => 
      uncategorizedTransactions.value.reduce((sum, transaction) => sum + transaction.amount, 0)
    )

    const hasTransactions = computed(() => totalTransactions.value > 0)

    // Track manual overrides (transactions that user has manually categorized)
    const manualOverrides = ref(new Map()) // Map of transaction hash -> true

    // Methods
    function toggleCategory(categoryName) {
      if (categoryName === 'uncategorized') {
        uncategorizedExpanded.value = !uncategorizedExpanded.value
      } else {
        if (expandedCategories.value.has(categoryName)) {
          expandedCategories.value.delete(categoryName)
        } else {
          expandedCategories.value.add(categoryName)
        }
      }
    }

    // Handle category change in transaction review
    function handleCategoryChange(item) {
      // Mark this transaction as manually overridden
      if (item.hash) {
        manualOverrides.value.set(item.hash, true)
      }
      
      // Update the transaction in previewsByAccount
      // Find and update the transaction in the previewsByAccount map
      for (const [accountId, transactions] of props.previewsByAccount) {
        const index = transactions.findIndex(tx => tx.hash === item.hash)
        if (index !== -1) {
          // Update the transaction with new category and mark as manual override
          transactions[index] = {
            ...transactions[index],
            category: item.category,
            category_source: 'manual',
            category_explain: 'Manual override during import review',
            manual_override: true
          }
          break
        }
      }
      
      // Emit event to notify parent component
      emit('transaction-updated', { transaction: item })
    }

    function clearFilters() {
      searchQuery.value = ''
      selectedCategory.value = ''
      selectedAccount.value = ''
    }

    // Use imported functions directly

    function goBackToRules() {
      emit('back-to-rules')
    }

    function importTransactions() {
      emit('save-and-import')
    }

    // Auto-expand categories with transactions
    watch(categoryGroups, (newGroups) => {
      newGroups.forEach(group => {
        if (group.transactions.length > 0 && !expandedCategories.value.has(group.name)) {
          expandedCategories.value.add(group.name)
        }
      })
    }, { immediate: true })

    // Auto-expand uncategorized if there are any
    watch(uncategorizedTransactions, (newUncategorized) => {
      if (newUncategorized.length > 0) {
        uncategorizedExpanded.value = true
      }
    }, { immediate: true })

    return {
      // State
      searchQuery,
      selectedCategory,
      selectedAccount,
      uncategorizedExpanded,
      expandedCategories,
      
      // Computed
      transactionHeaders,
      categoryOptions,
      accountOptions,
      allTransactions,
      filteredTransactions,
      categorizedTransactions,
      uncategorizedTransactions,
      categoryGroups,
      totalTransactions,
      categorizedCount,
      uncategorizedCount,
      totalInflow,
      totalOutflow,
      uncategorizedTotal,
      hasTransactions,
      
      // Methods
      toggleCategory,
      clearFilters,
      handleCategoryChange,
      getCategoryDisplayName: getCategoryName,
      getCategoryIcon,
      getCategoryColor,
      getCategorySelectOptions: () => CATEGORY_SELECT_OPTIONS,
      goBackToRules,
      importTransactions,
      manualOverrides
    }
  }
}
