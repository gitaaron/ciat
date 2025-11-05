<template>
  <div>
    <!-- Category Targets Section -->
    <div class="mb-6">
      <CategoryTargets ref="categoryTargetsRef" />
    </div>
    
    <!-- Charts Section -->
    <v-row v-if="!loading && hasTransactions">
      <v-col cols="12" lg="6">
        <PieChart ref="pieChartRef" />
      </v-col>
      <v-col cols="12" lg="6">
        <LineChart ref="lineChartRef" />
      </v-col>
    </v-row>
    
    <!-- Empty State -->
    <v-card v-else-if="!loading && !hasTransactions" class="text-center pa-8">
      <v-icon size="64" color="grey" class="mb-4">mdi-chart-pie</v-icon>
      <h2 class="text-h4 mb-2">No transactions imported yet</h2>
      <p class="text-h6 mb-4">Get started by importing transactions to begin tracking your finances.</p>
      <v-btn 
        color="primary" 
        size="large"
        @click="$emit('navigate-to-import')"
        prepend-icon="mdi-upload"
      >
        Import Transactions
      </v-btn>
    </v-card>
    
    <!-- Loading State -->
    <v-card v-else-if="loading" class="text-center pa-8">
      <v-progress-circular indeterminate color="primary" size="64" class="mb-4"></v-progress-circular>
      <h2 class="text-h4 mb-2">Loading reports...</h2>
      <p class="text-body-1">Please wait while we process your data.</p>
    </v-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import CategoryTargets from '../CategoryTargets/CategoryTargets.vue'
import PieChart from '../PieChart.vue'
import LineChart from '../LineChart.vue'
import api from '../api.js'

const loading = ref(true)
const hasTransactions = ref(false)
const pieChartRef = ref(null)
const lineChartRef = ref(null)
const categoryTargetsRef = ref(null)

async function checkTransactions() {
  try {
    loading.value = true
    const transactions = await api.listTransactions()
    hasTransactions.value = transactions.length > 0
  } catch (error) {
    console.error('Error checking transactions:', error)
    hasTransactions.value = false
  } finally {
    loading.value = false
  }
}

async function refresh() {
  await checkTransactions()
  // Refresh child chart components if they exist
  if (pieChartRef.value && pieChartRef.value.refresh) {
    await pieChartRef.value.refresh()
  }
  if (lineChartRef.value && lineChartRef.value.refresh) {
    await lineChartRef.value.refresh()
  }
  // Refresh CategoryTargets if it exists
  if (categoryTargetsRef.value && categoryTargetsRef.value.loadTransactions) {
    await categoryTargetsRef.value.loadTransactions()
  }
}

onMounted(() => {
  checkTransactions()
})

defineExpose({
  refresh
})

defineEmits(['navigate-to-import'])
</script>

<style scoped>
/* Additional styling if needed */
</style>
