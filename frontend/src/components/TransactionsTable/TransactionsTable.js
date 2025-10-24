import { ref, computed, onMounted, watch } from 'vue'
import api from '../api.js'
import { CATEGORY_OPTIONS, CATEGORY_SELECT_OPTIONS } from '../../config/categories.js'
import { showError } from '../../utils/notifications.js'

export default {
  name: 'TransactionsTable',
  setup() {
    // Reactive properties for filters and data
    const q = ref('')
    const start = ref('')
    const end = ref('')
    const category = ref('')
    const label = ref('')
    const sort = ref('date')
    const order = ref('DESC')
    const rows = ref([])
    const loading = ref(false)

    // Load transactions on component mount
    onMounted(async () => {
      await loadTransactions()
    })

    // Watch for filter changes and reload data
    watch([q, start, end, category, label, sort, order], async () => {
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
        if (sort.value) params.sort = sort.value
        if (order.value) params.order = order.value

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

    // Computed properties for category options
    const categoryFilterOptions = computed(() => CATEGORY_OPTIONS)
    const categorySelectOptions = computed(() => CATEGORY_SELECT_OPTIONS)

    return {
      // Reactive properties
      q,
      start,
      end,
      category,
      label,
      sort,
      order,
      rows,
      loading,
      // Computed properties
      categoryFilterOptions,
      categorySelectOptions,
      // Methods
      loadTransactions,
      getLabels,
      overrideCategory
    }
  }
}