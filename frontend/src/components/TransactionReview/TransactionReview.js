import { ref, computed, watch } from 'vue'

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
  emits: ['back-to-rules', 'import-transactions'],
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
      { title: 'Type', key: 'inflow', sortable: true },
      { title: 'Category', key: 'category', sortable: false },
      { title: 'Labels', key: 'labels', sortable: false }
    ]

    // Category options for filter
    const categoryOptions = computed(() => [
      { title: 'All Categories', value: '' },
      { title: 'Fixed Costs', value: 'fixed_costs' },
      { title: 'Investments', value: 'investments' },
      { title: 'Guilt Free', value: 'guilt_free' },
      { title: 'Short Term Savings', value: 'short_term_savings' },
      { title: 'Uncategorized', value: 'uncategorized' }
    ])

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
    
    const totalAmount = computed(() => 
      filteredTransactions.value.reduce((sum, transaction) => sum + transaction.amount, 0)
    )
    
    const uncategorizedTotal = computed(() => 
      uncategorizedTransactions.value.reduce((sum, transaction) => sum + transaction.amount, 0)
    )

    const hasTransactions = computed(() => totalTransactions.value > 0)

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

    function clearFilters() {
      searchQuery.value = ''
      selectedCategory.value = ''
      selectedAccount.value = ''
    }

    function getCategoryDisplayName(category) {
      const names = {
        'fixed_costs': 'Fixed Costs',
        'investments': 'Investments',
        'guilt_free': 'Guilt Free',
        'short_term_savings': 'Short Term Savings'
      }
      return names[category] || category
    }

    function getCategoryIcon(category) {
      const icons = {
        'fixed_costs': 'mdi-home',
        'investments': 'mdi-trending-up',
        'guilt_free': 'mdi-heart',
        'short_term_savings': 'mdi-piggy-bank'
      }
      return icons[category] || 'mdi-folder'
    }

    function getCategoryColor(category) {
      const colors = {
        'fixed_costs': 'blue',
        'investments': 'green',
        'guilt_free': 'pink',
        'short_term_savings': 'orange'
      }
      return colors[category] || 'grey'
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

    function getLabels(transaction) {
      if (!transaction.labels) return []
      if (typeof transaction.labels === 'string') {
        try {
          return JSON.parse(transaction.labels)
        } catch {
          return transaction.labels.split(',').map(l => l.trim()).filter(l => l)
        }
      }
      return Array.isArray(transaction.labels) ? transaction.labels : []
    }

    function goBackToRules() {
      emit('back-to-rules')
    }

    function importTransactions() {
      emit('import-transactions')
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
      totalAmount,
      uncategorizedTotal,
      hasTransactions,
      
      // Methods
      toggleCategory,
      clearFilters,
      getCategoryDisplayName,
      getCategoryIcon,
      getCategoryColor,
      formatDate,
      getLabels,
      goBackToRules,
      importTransactions
    }
  }
}
