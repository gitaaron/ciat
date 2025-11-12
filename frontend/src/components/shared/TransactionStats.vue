<template>
  <v-card class="mb-4" variant="outlined">
    <v-card-text>
      <v-row>
        <v-col cols="12" md="3">
          <div class="stat-item">
            <div class="stat-value">{{ totalTransactions }}</div>
            <div class="stat-label">Total Transactions</div>
          </div>
        </v-col>
        <v-col v-if="showCategorized" cols="12" md="3">
          <div class="stat-item">
            <div class="stat-value">{{ categorizedCount }}</div>
            <div class="stat-label">Categorized</div>
          </div>
        </v-col>
        <v-col v-if="showUncategorized" cols="12" md="3">
          <div class="stat-item">
            <div class="stat-value">{{ uncategorizedCount }}</div>
            <div class="stat-label">Uncategorized</div>
          </div>
        </v-col>
        <v-col v-if="showTotalAmount" cols="12" md="3">
          <div class="stat-item">
            <div 
              class="stat-value" 
              :class="netAmount >= 0 ? 'stat-surplus' : 'stat-deficit'"
            >
              {{ netAmount >= 0 ? '+' : '' }}${{ Math.abs(netAmount).toFixed(2) }}
            </div>
            <div class="stat-label">{{ netAmount >= 0 ? 'Total Surplus' : 'Total Deficit' }}</div>
          </div>
        </v-col>
        <v-col v-if="showUncategorizedAmount" cols="12" md="3">
          <div class="stat-item">
            <div class="stat-value">${{ uncategorizedTotal.toFixed(2) }}</div>
            <div class="stat-label">Uncategorized Amount</div>
          </div>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'TransactionStats',
  props: {
    totalTransactions: {
      type: Number,
      default: 0
    },
    categorizedCount: {
      type: Number,
      default: 0
    },
    uncategorizedCount: {
      type: Number,
      default: 0
    },
    totalInflow: {
      type: Number,
      default: 0
    },
    totalOutflow: {
      type: Number,
      default: 0
    },
    uncategorizedTotal: {
      type: Number,
      default: 0
    },
    showCategorized: {
      type: Boolean,
      default: true
    },
    showUncategorized: {
      type: Boolean,
      default: true
    },
    showTotalAmount: {
      type: Boolean,
      default: true
    },
    showUncategorizedAmount: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const netAmount = computed(() => props.totalInflow - props.totalOutflow)
    
    return {
      netAmount
    }
  }
}
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

.stat-value.stat-surplus {
  color: #4caf50;
}

.stat-value.stat-deficit {
  color: #f44336;
}

.stat-label {
  font-size: 0.875rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
