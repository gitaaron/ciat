<template>
  <div>
    <!-- Category Targets Section -->
    <div class="mb-6">
      <CategoryTargets />
    </div>
    
    <!-- Charts Section -->
    <v-row v-if="!loading && hasTransactions">
      <v-col cols="12" lg="6">
        <PieChart />
      </v-col>
      <v-col cols="12" lg="6">
        <LineChart />
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

onMounted(() => {
  checkTransactions()
})

defineEmits(['navigate-to-import'])
</script>

<style scoped>
/* Additional styling if needed */
</style>
