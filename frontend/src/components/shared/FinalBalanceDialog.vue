<template>
  <v-dialog :model-value="show" @update:model-value="handleDialogUpdate" max-width="500" persistent>
    <v-card>
      <v-card-title class="text-h6">
        Set Final Balance
      </v-card-title>
      
      <v-card-text>
        <p class="mb-4">
          This is the first import for <strong>{{ accountName }}</strong>. 
          Please enter the final balance (the balance after all transactions in this import).
        </p>
        <p class="mb-4 text-caption text-medium-emphasis">
          An initial balance transaction will be calculated automatically to ensure the account balance matches your input.
        </p>
        
        <v-text-field
          v-model.number="finalBalance"
          label="Final Balance"
          type="number"
          variant="outlined"
          prepend-inner-icon="mdi-currency-usd"
          :rules="[rules.required, rules.number]"
          autofocus
          @keyup.enter="handleConfirm"
        />
        
        <div v-if="calculatedInitialBalance !== null" class="mt-4 pa-3 bg-info rounded">
          <div class="text-caption font-weight-bold mb-1">Calculated Initial Balance:</div>
          <div class="text-h6">
            ${{ calculatedInitialBalance.toFixed(2) }}
          </div>
          <div class="text-caption mt-1">
            This transaction will be added on {{ earliestDate }} to balance the account.
          </div>
        </div>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="secondary"
          variant="text"
          @click="handleCancel"
          :disabled="loading"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          @click="handleConfirm"
          :disabled="loading || !isValid"
          :loading="loading"
        >
          Confirm
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, computed, watch } from 'vue'

export default {
  name: 'FinalBalanceDialog',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    accountName: {
      type: String,
      default: ''
    },
    transactions: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['confirm', 'cancel'],
  setup(props, { emit }) {
    const finalBalance = ref(null)
    
    const rules = {
      required: (v) => v !== null && v !== undefined && v !== '' || 'Final balance is required',
      number: (v) => !isNaN(v) || 'Must be a valid number'
    }
    
    const isValid = computed(() => {
      return finalBalance.value !== null && 
             finalBalance.value !== undefined && 
             finalBalance.value !== '' &&
             !isNaN(finalBalance.value)
    })
    
    // Calculate the sum of all transactions
    const transactionSum = computed(() => {
      if (!props.transactions || props.transactions.length === 0) return 0
      return props.transactions.reduce((sum, tx) => {
        const amount = parseFloat(tx.amount) || 0
        return sum + amount
      }, 0)
    })
    
    // Calculate initial balance: finalBalance - transactionSum
    const calculatedInitialBalance = computed(() => {
      if (finalBalance.value === null || finalBalance.value === undefined || isNaN(finalBalance.value)) {
        return null
      }
      return parseFloat(finalBalance.value) - transactionSum.value
    })
    
    // Find the earliest date from transactions
    const earliestDate = computed(() => {
      if (!props.transactions || props.transactions.length === 0) return ''
      const dates = props.transactions
        .map(tx => tx.date)
        .filter(date => date)
        .sort()
      return dates[0] || ''
    })
    
    watch(() => props.show, (newVal) => {
      if (newVal) {
        finalBalance.value = null
      }
    })
    
    function handleConfirm() {
      if (!isValid.value) return
      emit('confirm', {
        finalBalance: parseFloat(finalBalance.value),
        initialBalance: calculatedInitialBalance.value,
        earliestDate: earliestDate.value
      })
    }
    
    function handleCancel() {
      emit('cancel')
    }
    
    function handleDialogUpdate(value) {
      // If dialog is being closed (value is false), emit cancel
      if (!value) {
        emit('cancel')
      }
    }
    
    return {
      finalBalance,
      rules,
      isValid,
      calculatedInitialBalance,
      earliestDate,
      handleConfirm,
      handleCancel,
      handleDialogUpdate
    }
  }
}
</script>

<style scoped>
.bg-info {
  background-color: rgba(33, 150, 243, 0.1);
}
</style>

