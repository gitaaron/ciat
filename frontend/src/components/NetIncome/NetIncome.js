import { ref, computed, onMounted } from 'vue'
import api from '../api.js'
import { calculateDateRange } from '../../utils/dateRange.js'

export default {
  name: 'NetIncome',
  setup() {
    const transactions = ref([])
    const loading = ref(true)
    
    // Calculate total net income from inflow transactions
    const totalNetIncome = computed(() => {
      return transactions.value
        .filter(tx => tx.inflow === 1)
        .reduce((sum, tx) => sum + Number(tx.amount), 0)
    })
    
    // Calculate date range from all transactions
    const dateRange = computed(() => {
      return calculateDateRange(transactions.value)
    })
    
    // Calculate monthly net income (total divided by number of months)
    const monthlyNetIncome = computed(() => {
      if (dateRange.value.months === 0) return 0
      return totalNetIncome.value / dateRange.value.months
    })
    
    // Calculate annual net income (total divided by number of years)
    const annualNetIncome = computed(() => {
      if (dateRange.value.years === 0) return 0
      return totalNetIncome.value / dateRange.value.years
    })
    
    // Calculate total inflow
    const totalInflow = computed(() => {
      return transactions.value
        .filter(tx => {
          const inflow = tx.inflow
          return inflow === 1 || inflow === true || inflow === '1'
        })
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    })
    
    // Calculate total outflow
    const totalOutflow = computed(() => {
      return transactions.value
        .filter(tx => {
          const inflow = tx.inflow
          return !(inflow === 1 || inflow === true || inflow === '1')
        })
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    })
    
    // Calculate total surplus (inflow - outflow)
    const totalSurplus = computed(() => {
      return totalInflow.value - totalOutflow.value
    })
    
    // Load transactions
    const loadTransactions = async () => {
      try {
        loading.value = true
        transactions.value = await api.listTransactions()
      } catch (error) {
        console.error('Error loading transactions:', error)
      } finally {
        loading.value = false
      }
    }
    
    // Format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD'
      }).format(amount)
    }
    
    onMounted(() => {
      loadTransactions()
    })
    
    return {
      transactions,
      loading,
      totalNetIncome,
      monthlyNetIncome,
      annualNetIncome,
      dateRange,
      totalInflow,
      totalOutflow,
      totalSurplus,
      loadTransactions,
      formatCurrency
    }
  }
}

