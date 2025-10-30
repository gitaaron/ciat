<template>
  <div v-if="show" class="dialog-overlay" @click="handleCancel">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>Create New Rule</h3>
        <button class="close-btn" @click="handleCancel">×</button>
      </div>
      
      <div class="dialog-content">
        <div class="transaction-info">
          <h4>From Transaction:</h4>
          <p><strong>Merchant:</strong> {{ transaction?.name }}</p>
          <p><strong>Amount:</strong> {{ formatAmount(transaction?.amount) }}</p>
          <p><strong>Date:</strong> {{ formatDate(transaction?.date) }}</p>
        </div>
        
        <div class="rule-form">
          <div class="form-row">
            <label>Match Type:</label>
            <select v-model="ruleData.match_type" class="form-input">
              <option value="contains">Contains</option>
              <option value="regex">Regex</option>
              <option value="exact">Exact</option>
            </select>
          </div>
          
          <div class="form-row">
            <label>Pattern:</label>
            <input 
              v-model="ruleData.pattern" 
              class="form-input pattern-input"
              placeholder="Enter pattern to match..."
              :class="{ 'regex-input': ruleData.match_type === 'regex' }"
            >
            <small class="form-help">
              <span v-if="ruleData.match_type === 'contains'">Text that must be contained in the merchant name</span>
              <span v-else-if="ruleData.match_type === 'regex'">Regular expression pattern</span>
              <span v-else-if="ruleData.match_type === 'exact'">Exact merchant name match</span>
            </small>
            <div v-if="ruleData.pattern" class="pattern-preview">
              <strong>Preview:</strong> This rule will match transactions containing "<code>{{ ruleData.pattern }}</code>"
            </div>
          </div>
          
          <div class="form-row">
            <label>Category:</label>
            <select v-model="ruleData.category" class="form-input">
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
                v-model="ruleData.labels"
                label=""
                placeholder="e.g., Coffee, Travel, Work"
                hint=""
              />
            </div>
            <small class="form-help">Optional labels for grouping transactions</small>
          </div>
        </div>
      </div>
      
      <div class="dialog-actions">
        <button class="btn btn-secondary" @click="handleCancel" :disabled="loading">Cancel</button>
        <button class="btn btn-primary" @click="handleSave" :disabled="loading">
          <span v-if="loading" class="loading-spinner">⏳</span>
          <span v-if="loading">Creating...</span>
          <span v-else>Create Rule</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import MultiLabelSelector from '../MultiLabelSelector.vue'
import { CATEGORY_SELECT_OPTIONS } from '../../config/categories.js'

export default {
  name: 'CreateRuleDialog',
  components: {
    MultiLabelSelector
  },
  props: {
    show: {
      type: Boolean,
      default: false
    },
    transaction: {
      type: Object,
      default: null
    },
    initialData: {
      type: Object,
      default: () => ({
        match_type: 'contains',
        pattern: '',
        category: '',
        labels: []
      })
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['save', 'cancel'],
  data() {
    return {
      ruleData: {
        match_type: 'contains',
        pattern: '',
        category: '',
        labels: []
      }
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.initializeData()
      }
    },
    initialData: {
      handler() {
        this.initializeData()
      },
      deep: true
    }
  },
  computed: {
    categoryOptions() {
      return CATEGORY_SELECT_OPTIONS
    }
  },
  methods: {
    initializeData() {
      this.ruleData = {
        match_type: this.initialData.match_type || 'contains',
        pattern: this.initialData.pattern || (this.transaction?.name || ''),
        category: this.initialData.category || '',
        labels: [...(this.initialData.labels || [])]
      }
    },
    
    formatAmount(amount) {
      if (amount === null || amount === undefined || isNaN(amount)) return '$0.00'
      return `$${Number(amount).toFixed(2)}`
    },
    
    formatDate(dateString) {
      if (!dateString) return 'Unknown'
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Unknown'
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    },
    
    handleSave() {
      this.$emit('save', { ...this.ruleData })
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

.transaction-info {
  background-color: #f8f9fa;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 24px;
}

.transaction-info h4 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

.transaction-info p {
  margin: 4px 0;
  font-size: 0.9rem;
  color: #666;
}

.rule-form {
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

.form-input {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.pattern-input.regex-input {
  font-family: 'Courier New', monospace;
  background-color: #f8f9fa;
}

.form-help {
  color: #666;
  font-size: 0.8rem;
  margin-top: 4px;
}

.pattern-preview {
  background-color: #e8f4fd;
  border: 1px solid #b3d9ff;
  border-radius: 4px;
  padding: 8px 12px;
  margin-top: 8px;
  font-size: 0.85rem;
}

.pattern-preview code {
  background-color: #fff;
  padding: 2px 4px;
  border-radius: 2px;
  font-family: 'Courier New', monospace;
  color: #d63384;
}

.label-autocomplete-container {
  width: 100%;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 24px;
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
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  display: inline-block;
  margin-right: 8px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
