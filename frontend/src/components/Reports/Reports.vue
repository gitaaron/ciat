<template>
  <div>
    <!-- Date Filters -->
    <v-card v-if="hasTransactions" class="mb-6">
      <v-card-title class="text-h6">
        <v-icon left>mdi-chart-pie</v-icon>
        Reports
      </v-card-title>
      <v-card variant="outlined" class="ma-4">
        <v-card-text>
          <TransactionFilters
            v-model:start-date="startDate"
            v-model:end-date="endDate"
            :available-years="availableYears"
            :show-category-filter="false"
            :show-account-filter="false"
            :show-date-filters="true"
            :show-label-filter="false"
            :show-search-filter="false"
            :show-card="false"
            :search-query="''"
            clear-button-text="Reset"
            @clear-filters="clearDateFilters"
          />
        </v-card-text>


      </v-card>
    </v-card>
    
    <!-- Category Targets Section -->
    <div class="mb-6">
      <CategoryTargets ref="categoryTargetsRef" :start-date="startDate" :end-date="endDate" />
    </div>
    <!-- Report Stats Section -->
    <div class="mb-6">
      <ReportStats ref="reportStatsRef" :start-date="startDate" :end-date="endDate" />
    </div>
    <!-- Charts Section -->
    <v-row v-if="!loading && hasTransactions">
      <v-col cols="12" lg="6">
        <PieChart ref="pieChartRef" :start-date="startDate" :end-date="endDate" />
      </v-col>
      <v-col cols="12" lg="6">
        <LineChart ref="lineChartRef" :start-date="startDate" :end-date="endDate" @dot-click="handleDotClick" />
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
import ReportStats from '../ReportStats/ReportStats.vue'
import CategoryTargets from '../CategoryTargets/CategoryTargets.vue'
import PieChart from '../PieChart.vue'
import LineChart from '../LineChart.vue'
import TransactionFilters from '../shared/TransactionFilters.vue'
import api from '../api.js'

const loading = ref(true)
const hasTransactions = ref(false)
const reportStatsRef = ref(null)
const pieChartRef = ref(null)
const lineChartRef = ref(null)
const categoryTargetsRef = ref(null)
const startDate = ref('')
const endDate = ref('')
const datesInitialized = ref(false)
const availableYears = ref([])

const emit = defineEmits(['navigate-to-import', 'navigate-to-transactions'])

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

        // Calculate the list of years that have transactions
        const yearsSet = new Set(
          allTransactions
            .map(tx => tx.date)
            .filter(date => !!date)
            .map(date => {
              const year = new Date(date).getFullYear()
              return Number.isNaN(year) ? null : year
            })
            .filter(year => year !== null)
        )
        availableYears.value = Array.from(yearsSet).sort((a, b) => a - b)

        // Set dates - the watch will automatically trigger refresh
        datesInitialized.value = true
        startDate.value = earliestDate
        endDate.value = latestDate
      }
    }
  } catch (error) {
    console.error('Error initializing date range:', error)
    // Continue with empty dates if there's an error
  }
}

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
  // Refresh ReportStats if it exists
  if (reportStatsRef.value && reportStatsRef.value.loadTransactions) {
    await reportStatsRef.value.loadTransactions()
  }
  // Refresh CategoryTargets if it exists
  if (categoryTargetsRef.value && categoryTargetsRef.value.loadTransactions) {
    await categoryTargetsRef.value.loadTransactions()
  }
}

function clearDateFilters() {
  // Re-initialize dates to first and last transaction dates
  initializeDateRange()
}

// Note: Child components watch their props (startDate/endDate) and automatically refresh
// when dates change, so no need for a watch here

onMounted(async () => {
  await checkTransactions()
  // Initialize date range if transactions exist
  if (hasTransactions.value && !datesInitialized.value) {
    await initializeDateRange()
  }
})

function handleDotClick(data) {
  emit('navigate-to-transactions', data)
}

defineExpose({
  refresh
})
</script>

<style scoped>
/* Additional styling if needed */
</style>
