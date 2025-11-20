<template>
  <div v-if="show" class="dialog-overlay" @click="handleCancel">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>New Transaction</h3>
        <button class="close-btn" @click="handleCancel">×</button>
      </div>
      
      <div class="dialog-content">
        <div class="transaction-form">
          <div class="form-row">
            <label>Account <span class="required">*</span>:</label>
            <select v-model="transactionData.account_id" class="form-input" required>
              <option value="">Select an account</option>
              <option 
                v-for="account in accounts" 
                :key="account.id" 
                :value="account.id"
              >
                {{ account.name }}
              </option>
            </select>
          </div>
          
          <div class="form-row">
            <label>Date <span class="required">*</span>:</label>
            <input 
              v-model="transactionData.date" 
              type="date"
              class="form-input"
              required
            >
          </div>
          
          <div class="form-row">
            <label>Name <span class="required">*</span>:</label>
            <input 
              v-model="transactionData.name" 
              class="form-input"
              placeholder="e.g., Grocery Store"
              required
            >
          </div>
          
          <div class="form-row">
            <label>Description:</label>
            <input 
              v-model="transactionData.description" 
              class="form-input"
              placeholder="Optional description"
            >
          </div>
          
          <div class="form-row">
            <label>Amount <span class="required">*</span>:</label>
            <input 
              v-model.number="transactionData.amount" 
              type="number"
              step="0.01"
              class="form-input"
              placeholder="0.00"
              required
            >
          </div>
          
          <div class="form-row">
            <label>Type:</label>
            <select v-model="transactionData.inflow" class="form-input">
              <option :value="false">Outflow (Expense)</option>
              <option :value="true">Inflow (Income)</option>
            </select>
          </div>
          
          <div class="form-row">
            <label>Category:</label>
            <select v-model="transactionData.category" class="form-input">
              <option 
                v-for="option in categoryOptions" 
                :key="option.value" 
                :value="option.value"
              >
                {{ option.title }}
              </option>
            </select>
          </div>
          
          <div class="form-row">
            <label>Labels (Optional):</label>
            <div class="label-autocomplete-container">
              <MultiLabelSelector
                v-model="transactionData.labels"
                label=""
                placeholder="e.g., Coffee, Travel, Work"
                hint=""
              />
            </div>
            <small class="form-help">Optional labels for grouping transactions</small>
          </div>
          
          <div class="form-row">
            <label>Note:</label>
            <textarea 
              v-model="transactionData.note" 
              class="form-input"
              rows="3"
              placeholder="Optional note"
            ></textarea>
          </div>
        </div>
      </div>
      
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="handleCancel" :disabled="loading">Cancel</button>
        <button class="btn btn-primary" @click="handleSave" :disabled="loading || !isValid">
          <span v-if="loading" class="loading-spinner">⏳</span>
          <span v-if="loading">Creating...</span>
          <span v-else>Create Transaction</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import MultiLabelSelector from '../MultiLabelSelector.vue'
import { CATEGORY_SELECT_OPTIONS } from '../../config/categories.js'

export default {
  name: 'NewTransactionDialog',
  components: {
    MultiLabelSelector
  },
  props: {
    show: {
      type: Boolean,
      default: false
    },
    accounts: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['save', 'cancel'],
  data() {
    return {
      transactionData: {
        account_id: '',
        date: this.getTodayDate(),
        name: '',
        description: '',
        amount: null,
        inflow: false,
        category: '',
        labels: [],
        note: ''
      }
    }
  },
  computed: {
    categoryOptions() {
      return CATEGORY_SELECT_OPTIONS
    },
    isValid() {
      return !!(
        this.transactionData.account_id &&
        this.transactionData.date &&
        this.transactionData.name &&
        this.transactionData.amount !== null &&
        this.transactionData.amount !== '' &&
        !isNaN(this.transactionData.amount) &&
        this.transactionData.amount !== 0
      )
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.resetForm()
      }
    }
  },
  methods: {
    getTodayDate() {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    resetForm() {
      this.transactionData = {
        account_id: '',
        date: this.getTodayDate(),
        name: '',
        description: '',
        amount: null,
        inflow: false,
        category: '',
        labels: [],
        note: ''
      }
    },
    handleSave() {
      if (!this.isValid) return
      this.$emit('save', { ...this.transactionData })
    },
    handleCancel() {
      this.$emit('cancel')
    }
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  margin-top: 80px;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f5f5f5;
}

.dialog-content {
  padding: 24px;
}

.transaction-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row label {
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
}

.required {
  color: #d32f2f;
}

.form-input {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-input textarea {
  resize: vertical;
  min-height: 60px;
}

.form-help {
  color: #666;
  font-size: 0.8rem;
  margin-top: 4px;
}

.label-autocomplete-container {
  margin-top: 4px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #f5f5f5;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e0e0e0;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.loading-spinner {
  display: inline-block;
}
</style>

