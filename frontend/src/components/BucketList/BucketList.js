import { ref, reactive, computed, onMounted } from 'vue'
import api from '../api.js'
import { 
  calculateShortTermSavingsDeviation,
  calculateMonthlyDeviation
} from '../../utils/shortTermSavingsDeviation.js'

export default {
  setup() {
    const items = ref([])
    const showDialog = ref(false)
    const showDeleteDialog = ref(false)
    const editingItem = ref(null)
    const itemToDelete = ref(null)
    const formValid = ref(false)
    const formRef = ref(null)
    const transactions = ref([])
    const loading = ref(false)
    const targets = ref({
      fixed_costs: 35,
      investments: 10,
      guilt_free: 40,
      short_term_savings: 15
    })
    const targetSavingsAmount = ref(0) // Dollar amount, not percentage
    const targetSavingsInput = ref('0.00') // String input for editing
    const showTargetSavingsDialog = ref(false)
    const editingTargetSavings = ref(false)
    const isReorderMode = ref(false)
    const draggedItemId = ref(null)
    const draggedOverItemId = ref(null)

    const formData = reactive({
      name: '',
      description: '',
      estimatedCost: null
    })

    const rules = {
      required: (value) => {
        if (!value || !value.trim()) {
          return 'This field is required'
        }
        return true
      }
    }

    function formatCurrency(amount) {
      if (!amount && amount !== 0) return 'N/A'
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount)
    }

    // Filter transactions to last 12 months from the latest transaction date
    const last12MonthsTransactions = computed(() => {
      if (transactions.value.length === 0) return []
      
      // Find the latest transaction date
      const dates = transactions.value
        .map(tx => tx.date)
        .filter(date => date)
        .sort()
      
      if (dates.length === 0) return []
      
      const lastTransactionDate = new Date(dates[dates.length - 1])
      const endDate = lastTransactionDate
      const startDate = new Date(lastTransactionDate)
      startDate.setMonth(startDate.getMonth() - 12)
      
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]
      
      // Filter transactions to last 12 months from latest transaction
      return transactions.value.filter(tx => {
        if (!tx.date) return false
        return tx.date >= startDateStr && tx.date <= endDateStr
      })
    })

    // Calculate total surplus using the same calculation as short term savings deviation
    const totalSurplus = computed(() => {
      return calculateShortTermSavingsDeviation(transactions.value, targets.value)
    })

    // Calculate total cost of all bucket list items
    const totalCost = computed(() => {
      return items.value.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0)
    })

    // Calculate monthly spend (target short term monthly for last 12 months)
    // Uses the same calculation method as CategoryTargets component
    const monthlySpend = computed(() => {
      if (last12MonthsTransactions.value.length === 0) return 0
      
      // Calculate total net income from income transactions (same as CategoryTargets)
      const totalNetIncome = last12MonthsTransactions.value
        .filter(tx => tx.category === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
      
      // Calculate date range from filtered transactions (same method as CategoryTargets)
      const dates = last12MonthsTransactions.value
        .map(tx => tx.date)
        .filter(date => date)
        .sort()
      
      if (dates.length === 0) return 0
      
      const startDate = new Date(dates[0])
      const endDate = new Date(dates[dates.length - 1])
      const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24)
      const totalMonths = Math.max(totalDays / 30.4375, 0.1) // Same as CategoryTargets
      
      // Calculate monthly net income (same as CategoryTargets)
      const monthlyNetIncome = totalMonths > 0 ? totalNetIncome / totalMonths : 0
      
      // Calculate monthly target for short_term_savings (same as CategoryTargets)
      const monthlyTarget = (monthlyNetIncome * (targets.value.short_term_savings || 0)) / 100
      
      return monthlyTarget
    })

    // Calculate max target savings (monthly spend over last 12 months)
    const maxTargetSavings = computed(() => {
      return monthlySpend.value
    })

    // Calculate monthly actual for short_term_savings (same method as CategoryTargets)
    const monthlyActual = computed(() => {
      if (last12MonthsTransactions.value.length === 0) return 0
      
      // Calculate date range from filtered transactions (same method as CategoryTargets)
      const dates = last12MonthsTransactions.value
        .map(tx => tx.date)
        .filter(date => date)
        .sort()
      
      if (dates.length === 0) return 0
      
      const startDate = new Date(dates[0])
      const endDate = new Date(dates[dates.length - 1])
      const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24)
      const totalMonths = Math.max(totalDays / 30.4375, 0.1) // Same as CategoryTargets
      
      // Calculate total actual for short_term_savings (outflows - inflows) - same as CategoryTargets
      const categoryTransactions = last12MonthsTransactions.value.filter(tx => tx.category === 'short_term_savings')
      const inflows = categoryTransactions
        .filter(tx => tx.inflow === 1)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
      const outflows = categoryTransactions
        .filter(tx => tx.inflow === 0)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
      const totalActual = outflows - inflows
      
      // Calculate monthly actual (same as CategoryTargets: totalActual / months)
      return totalMonths > 0 ? totalActual / totalMonths : 0
    })

    // Target savings is the deviation between monthly target and monthly actual
    const targetSavings = computed(() => {
      return monthlySpend.value - monthlyActual.value
    })

    // Calculate affordability for each item (cascading)
    const itemsWithAffordability = computed(() => {
      let remainingSurplus = totalSurplus.value
      
      return items.value.map((item) => {
        const cost = item.estimatedCost || 0
        const newRemaining = remainingSurplus - cost
        const canAfford = newRemaining >= 0
        
        // Calculate months to afford if remaining is negative
        let monthsToAfford = null
        if (newRemaining < 0 && targetSavingsAmount.value > 0) {
          monthsToAfford = Math.ceil(Math.abs(newRemaining) / targetSavingsAmount.value)
        }
        
        // Update remaining for next item
        remainingSurplus = newRemaining
        
        return {
          ...item,
          remainingSurplus: newRemaining,
          canAfford,
          monthsToAfford
        }
      })
    })

    // Load category targets
    async function loadTargets() {
      try {
        const saved = await api.getCategoryTargets()
        if (saved) {
          // Completely replace the targets object to ensure reactivity
          targets.value = {
            fixed_costs: saved.fixed_costs ?? 35,
            investments: saved.investments ?? 10,
            guilt_free: saved.guilt_free ?? 40,
            short_term_savings: saved.short_term_savings ?? 15
          }
        }
      } catch (error) {
        console.error('Error loading saved targets:', error)
        // Keep defaults if loading fails
      }
    }

    // Calculate initial target savings amount based on deviation over last 12 months
    function calculateInitialTargetSavingsAmount() {
      if (last12MonthsTransactions.value.length === 0) {
        console.log('No transactions available in last 12 months, using default 0')
        return 0
      }
      
      // Calculate monthly deviation over last 12 months (target monthly - actual monthly)
      // Uses transactions filtered to last 12 months from latest transaction
      const monthlyDeviation = calculateMonthlyDeviation(last12MonthsTransactions.value, targets.value)
      
      console.log('Calculated initial target savings amount:', {
        monthlyDeviation
      })
      
      // Target savings is the monthly deviation
      return monthlyDeviation
    }

    // Load target savings amount
    async function loadTargetSavings() {
      try {
        const saved = await api.getTargetSavings()
        if (saved && saved !== null && typeof saved.amount === 'number') {
          targetSavingsAmount.value = saved.amount
        } else {
          // No saved value, calculate initial amount based on deviation
          const calculatedAmount = calculateInitialTargetSavingsAmount()
          targetSavingsAmount.value = calculatedAmount
          console.log('Calculated initial target savings amount:', calculatedAmount)
        }
      } catch (error) {
        console.error('Error loading target savings:', error)
        // Calculate initial amount even on error
        const calculatedAmount = calculateInitialTargetSavingsAmount()
        targetSavingsAmount.value = calculatedAmount
        console.log('Calculated initial target savings amount (on error):', calculatedAmount)
      }
    }

    // Save target savings amount
    async function saveTargetSavings() {
      try {
        loading.value = true
        // Parse the input string and format it
        const cleanedValue = String(targetSavingsInput.value).replace(/[^0-9.]/g, '')
        const numValue = parseFloat(cleanedValue) || 0
        // Clamp the value to max (monthly spend) and round to 2 decimal places for currency
        const amountToSave = Math.round(Math.min(Math.max(0, isNaN(numValue) ? 0 : numValue), maxTargetSavings.value) * 100) / 100
        await api.saveTargetSavings(amountToSave)
        targetSavingsAmount.value = amountToSave
        targetSavingsInput.value = amountToSave.toFixed(2)
        editingTargetSavings.value = false
        showTargetSavingsDialog.value = false
      } catch (error) {
        console.error('Error saving target savings:', error)
        // Keep dialog open on error so user can retry
      } finally {
        loading.value = false
      }
    }

    // Format target savings input on blur to ensure 2 decimal places and clamp to max
    function formatTargetSavingsOnBlur() {
      // Parse the input string, removing any non-numeric characters except decimal point
      const cleanedValue = String(targetSavingsInput.value).replace(/[^0-9.]/g, '')
      const numValue = parseFloat(cleanedValue) || 0
      const clampedValue = Math.min(Math.max(0, isNaN(numValue) ? 0 : numValue), maxTargetSavings.value)
      // Update both the numeric value and the formatted input string
      targetSavingsAmount.value = parseFloat(clampedValue.toFixed(2))
      targetSavingsInput.value = clampedValue.toFixed(2)
    }

    // Start editing target savings
    function startEditingTargetSavings() {
      // Initialize input with formatted value (2 decimal places)
      targetSavingsInput.value = targetSavingsAmount.value.toFixed(2)
      editingTargetSavings.value = true
      showTargetSavingsDialog.value = true
    }

    // Reset target savings to calculated value
    function resetTargetSavings() {
      const calculatedAmount = calculateInitialTargetSavingsAmount()
      const formattedAmount = parseFloat(calculatedAmount.toFixed(2))
      targetSavingsAmount.value = formattedAmount
      targetSavingsInput.value = formattedAmount.toFixed(2)
    }

    // Cancel editing target savings
    function cancelEditingTargetSavings() {
      // Reset input to current saved value
      targetSavingsInput.value = targetSavingsAmount.value.toFixed(2)
      editingTargetSavings.value = false
      showTargetSavingsDialog.value = false
    }

    // Reorder functionality
    function toggleReorderMode() {
      if (isReorderMode.value) {
        // Save order
        saveOrder()
      } else {
        // Enter reorder mode
        isReorderMode.value = true
      }
    }

    function cancelReorder() {
      isReorderMode.value = false
      draggedItemId.value = null
      draggedOverItemId.value = null
      // Reload items to reset order
      loadItems()
    }

    async function saveOrder() {
      try {
        loading.value = true
        const orderedIds = items.value.map(item => item.id)
        await api.reorderBucketListItems(orderedIds)
        isReorderMode.value = false
        draggedItemId.value = null
        draggedOverItemId.value = null
        // Reload items to get updated order from backend
        await loadItems()
        // Recalculate affordability
        await loadTransactions()
        await loadTargets()
      } catch (error) {
        console.error('Error saving order:', error)
        // Keep in reorder mode on error so user can retry
      } finally {
        loading.value = false
      }
    }

    function handleDragStart(event, itemId) {
      draggedItemId.value = itemId
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/html', itemId)
    }

    function handleDragOver(event, itemId) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (draggedItemId.value !== itemId) {
        draggedOverItemId.value = itemId
      }
    }

    function handleDragLeave() {
      draggedOverItemId.value = null
    }

    function handleDrop(event, targetItemId) {
      event.preventDefault()
      if (!draggedItemId.value || draggedItemId.value === targetItemId) {
        draggedItemId.value = null
        draggedOverItemId.value = null
        return
      }

      const draggedIndex = items.value.findIndex(item => item.id === draggedItemId.value)
      const targetIndex = items.value.findIndex(item => item.id === targetItemId)

      if (draggedIndex === -1 || targetIndex === -1) {
        draggedItemId.value = null
        draggedOverItemId.value = null
        return
      }

      // Reorder items array
      const [draggedItem] = items.value.splice(draggedIndex, 1)
      items.value.splice(targetIndex, 0, draggedItem)

      draggedItemId.value = null
      draggedOverItemId.value = null
    }

    function handleDragEnd() {
      draggedItemId.value = null
      draggedOverItemId.value = null
    }

    // Load transactions to calculate surplus
    async function loadTransactions() {
      try {
        loading.value = true
        transactions.value = await api.listTransactions({})
      } catch (error) {
        console.error('Error loading transactions:', error)
        transactions.value = []
      } finally {
        loading.value = false
      }
    }

    async function loadItems() {
      try {
        loading.value = true
        const data = await api.getBucketListItems()
        // Map database field names to frontend field names
        items.value = data.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          estimatedCost: item.estimated_cost,
          createdAt: item.created_at,
          order: item.order ?? 0
        }))
        // Sort by order to ensure correct display
        items.value.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      } catch (error) {
        console.error('Error loading bucket list items:', error)
        items.value = []
      } finally {
        loading.value = false
      }
    }

    function openAddDialog() {
      editingItem.value = null
      formData.name = ''
      formData.description = ''
      formData.estimatedCost = null
      showDialog.value = true
    }

    function openEditDialog(item) {
      editingItem.value = item
      formData.name = item.name
      formData.description = item.description || ''
      formData.estimatedCost = item.estimatedCost || null
      showDialog.value = true
    }

    function closeDialog() {
      showDialog.value = false
      editingItem.value = null
      formData.name = ''
      formData.description = ''
      formData.estimatedCost = null
      if (formRef.value) {
        formRef.value.resetValidation()
      }
    }

    async function saveItem() {
      if (!formValid.value) return

      try {
        loading.value = true
        if (editingItem.value) {
          // Update existing item
          const updated = await api.updateBucketListItem(editingItem.value.id, {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            estimatedCost: formData.estimatedCost || null
          })
          // Map database field names to frontend field names
          const index = items.value.findIndex(item => item.id === editingItem.value.id)
          if (index !== -1) {
            items.value[index] = {
              id: updated.id,
              name: updated.name,
              description: updated.description,
              estimatedCost: updated.estimated_cost,
              createdAt: updated.created_at
            }
          }
        } else {
          // Add new item
          const newItem = await api.createBucketListItem({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            estimatedCost: formData.estimatedCost || null
          })
          // Map database field names to frontend field names
          items.value.push({
            id: newItem.id,
            name: newItem.name,
            description: newItem.description,
            estimatedCost: newItem.estimated_cost,
            createdAt: newItem.created_at
          })
        }
        closeDialog()
      } catch (error) {
        console.error('Error saving bucket list item:', error)
        // Keep dialog open on error so user can retry
      } finally {
        loading.value = false
      }
    }

    function confirmDelete(item) {
      itemToDelete.value = item
      showDeleteDialog.value = true
    }

    async function deleteItem() {
      if (itemToDelete.value) {
        try {
          loading.value = true
          await api.deleteBucketListItem(itemToDelete.value.id)
          const index = items.value.findIndex(item => item.id === itemToDelete.value.id)
          if (index !== -1) {
            items.value.splice(index, 1)
          }
        } catch (error) {
          console.error('Error deleting bucket list item:', error)
        } finally {
          loading.value = false
        }
      }
      showDeleteDialog.value = false
      itemToDelete.value = null
    }

    return {
      items,
      showDialog,
      showDeleteDialog,
      editingItem,
      itemToDelete,
      formData,
      formValid,
      formRef,
      rules,
      formatCurrency,
      loadItems,
      openAddDialog,
      openEditDialog,
      closeDialog,
      saveItem,
      confirmDelete,
      deleteItem,
      transactions,
      loading,
      totalSurplus,
      totalCost,
      itemsWithAffordability,
      loadTransactions,
      loadTargets,
      targets,
      monthlySpend,
      targetSavings,
      targetSavingsAmount,
      targetSavingsInput,
      maxTargetSavings,
      showTargetSavingsDialog,
      editingTargetSavings,
      loadTargetSavings,
      saveTargetSavings,
      formatTargetSavingsOnBlur,
      resetTargetSavings,
      startEditingTargetSavings,
      cancelEditingTargetSavings,
      isReorderMode,
      draggedItemId,
      draggedOverItemId,
      toggleReorderMode,
      cancelReorder,
      saveOrder,
      handleDragStart,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleDragEnd
    }
  }
}

