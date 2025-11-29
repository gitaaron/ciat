<template>
  <v-card class="mb-4">
    <v-card-text>
      <div v-if="loading" class="text-center pa-4">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading transactions...</p>
      </div>
      
      <div v-else-if="monthlyNetIncome <= 0" class="text-center pa-4">
        <v-icon size="48" color="grey">mdi-information</v-icon>
        <p class="text-h6 mt-2">No income data available</p>
        <p class="text-body-2">Import transactions to view net income</p>
      </div>
      
      <v-row v-else>
        <v-col cols="12" md="3">
          <div class="stat-item">
            <div class="stat-value">{{ formatCurrencyValue(monthlyNetIncome) }}</div>
            <div class="stat-label">Monthly Net Income</div>
          </div>
        </v-col>
        <v-col cols="12" md="3">
          <div class="stat-item">
            <div class="stat-value">{{ formatCurrencyValue(annualNetIncome) }}</div>
            <div class="stat-label">Annual Net Income</div>
          </div>
        </v-col>
        <v-col cols="12" md="3">
          <div class="stat-item">
            <div class="stat-value">{{ dateRange.months.toFixed(1) }} months</div>
            <div class="stat-label">Data Period</div>
          </div>
        </v-col>
        <v-col cols="12" md="3">
          <div class="stat-item">
            <div 
              class="stat-value" 
              :class="surplusDeficitClass"
            >
              {{ formattedTotalSurplus }}
            </div>
            <div class="stat-label">{{ surplusDeficitLabel }}</div>
          </div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed, watch } from 'vue'
import ReportStats from './ReportStats.js'
import { getSurplusDeficitLabel, getSurplusDeficitClass, formatCurrencyValue } from '../../utils/surplusDeficit.js'

const props = defineProps({
  startDate: {
    type: String,
    default: ''
  },
  endDate: {
    type: String,
    default: ''
  }
})

const {
  loading,
  monthlyNetIncome,
  annualNetIncome,
  dateRange,
  totalSurplus,
  loadTransactions,
  formatCurrency
} = ReportStats.setup(props)

// Watch for date changes and reload transactions
watch([() => props.startDate, () => props.endDate], () => {
  loadTransactions()
})

const surplusDeficitLabel = computed(() => getSurplusDeficitLabel(totalSurplus.value))
const surplusDeficitClass = computed(() => getSurplusDeficitClass(totalSurplus.value))
const formattedTotalSurplus = computed(() => formatCurrencyValue(totalSurplus.value))

defineExpose({
  loadTransactions
})
</script>

<style scoped>
.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1976d2;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value.stat-surplus {
  color: #4caf50;
}

.stat-value.stat-deficit {
  color: #f44336;
}
</style>

