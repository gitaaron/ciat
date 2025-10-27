import { ref, computed, onMounted, watch } from 'vue'
import api from '../api.js'
import { CATEGORY_OPTIONS, CATEGORY_SELECT_OPTIONS } from '../../config/categories.js'
import { showError } from '../../utils/notifications.js'
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
  setup(props) {
    // Reactive properties for filters and data
    const q = ref('')
    const start = ref('')
    const end = ref('')
    const category = ref('')
    const label = ref('')
    const account = ref('')
    const rows = ref([])
    const loading = ref(false)

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
      { title: 'Explain', key: 'category_explain', sortable: false },
      { title: 'Actions', key: 'actions', sortable: false }
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

    async function overrideCategory(item) {
      try {
        await api.updateTransaction(item.id, {
          category: item.category
        })
        // Reload transactions to reflect changes
        await loadTransactions()
      } catch (error) {
        console.error('Error updating transaction category:', error)
        showError('Error updating transaction category: ' + error.message)
      }
    }

    function clearFilters() {
      q.value = ''
      start.value = ''
      end.value = ''
      category.value = ''
      label.value = ''
      account.value = ''
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
      overrideCategory,
      clearFilters
    }
  }
}