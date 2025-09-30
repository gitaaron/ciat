
<script setup>
import { ref, computed, watch } from 'vue'
import api from './api.js'

const props = defineProps({ accounts: Array })
const emit = defineEmits(['refresh-accounts'])

const newAccount = ref('')
const step = ref(1) // 1: file selection, 2: account assignment, 3: review, 4: complete
const files = ref([])
const fileAnalysis = ref([])
const filesByAccount = ref(new Map()) // Map<accountId, File[]>
const previewsByAccount = ref(new Map()) // Map<accountId, preview[]>
const isDragOver = ref(false)
const processing = ref(false)
const currentCategoryStep = ref(0) // 0: fixed, 1: investments, 2: guilt_free, 3: short_term
const categorySteps = ['fixed_costs', 'investments', 'guilt_free', 'short_term_savings']
const categoryStepNames = ['Fixed Costs', 'Investments', 'Guilt Free', 'Short Term Savings']

const totalFiles = computed(() => files.value.length)

const totalTransactions = computed(() => {
  let total = 0
  for (const preview of previewsByAccount.value.values()) {
    total += preview.length
  }
  return total
})

const currentCategoryTransactions = computed(() => {
  const allTransactions = []
  for (const preview of previewsByAccount.value.values()) {
    allTransactions.push(...preview)
  }
  return allTransactions.filter(tx => 
    !tx.ignore && 
    tx.category === categorySteps[currentCategoryStep.value]
  )
})

const hasMoreCategories = computed(() => {
  return currentCategoryStep.value < categorySteps.length - 1
})

const hasPreviousCategories = computed(() => {
  return currentCategoryStep.value > 0
})

const allFilesAssigned = computed(() => {
  return fileAnalysis.value.every((analysis, index) => {
    return getCurrentAccountId(index) !== null
  })
})

function getCurrentAccountId(fileIndex) {
  const file = files.value[fileIndex]
  for (const [accountId, accountFiles] of filesByAccount.value) {
    if (accountFiles.includes(file)) {
      return accountId
    }
  }
  return null
}

function getAccountName(accountId) {
  const account = props.accounts.find(a => a.id === accountId)
  return account ? account.name : 'Unknown Account'
}

async function addAccount() {
  if (!newAccount.value) return
  await api.createAccount(newAccount.value)
  newAccount.value = ''
  await emit('refresh-accounts')
}

function handleDragOver(e) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave(e) {
  e.preventDefault()
  isDragOver.value = false
}

function handleDrop(e) {
  e.preventDefault()
  isDragOver.value = false
  
  const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
    file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
  )
  
  if (droppedFiles.length === 0) {
    alert('Please drop CSV files only')
    return
  }
  
  files.value = [...files.value, ...droppedFiles]
  analyzeFiles()
}

function handleFileSelect(e) {
  const selectedFiles = Array.from(e.target.files).filter(file => 
    file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
  )
  
  if (selectedFiles.length === 0) {
    alert('Please select CSV files only')
    return
  }
  
  files.value = [...files.value, ...selectedFiles]
  analyzeFiles()
}

async function analyzeFiles() {
  if (files.value.length === 0) return
  
  processing.value = true
  try {
    const result = await api.analyzeFiles(files.value)
    fileAnalysis.value = result.analysis
    
    // Auto-assign files based on suggestions
    filesByAccount.value.clear()
    for (const analysis of fileAnalysis.value) {
      const file = files.value.find(f => f.name === analysis.filename)
      if (file) {
        const accountId = analysis.suggestedAccount?.id || props.accounts[0]?.id
        if (accountId) {
          if (!filesByAccount.value.has(accountId)) {
            filesByAccount.value.set(accountId, [])
          }
          filesByAccount.value.get(accountId).push(file)
        }
      }
    }
    
    step.value = 2
  } catch (error) {
    console.error('Error analyzing files:', error)
    alert('Error analyzing files: ' + error.message)
  } finally {
    processing.value = false
  }
}

function removeFile(fileIndex) {
  files.value.splice(fileIndex, 1)
  fileAnalysis.value.splice(fileIndex, 1)
  
  // Remove from filesByAccount
  for (const [accountId, accountFiles] of filesByAccount.value) {
    const index = accountFiles.findIndex(f => f === files.value[fileIndex])
    if (index !== -1) {
      accountFiles.splice(index, 1)
      if (accountFiles.length === 0) {
        filesByAccount.value.delete(accountId)
      }
      break
    }
  }
}

function reassignFile(fileIndex, newAccountId) {
  const file = files.value[fileIndex]
  
  // Remove from current account
  for (const [accountId, accountFiles] of filesByAccount.value) {
    const index = accountFiles.findIndex(f => f === file)
    if (index !== -1) {
      accountFiles.splice(index, 1)
      if (accountFiles.length === 0) {
        filesByAccount.value.delete(accountId)
      }
      break
    }
  }
  
  // Add to new account
  if (!filesByAccount.value.has(newAccountId)) {
    filesByAccount.value.set(newAccountId, [])
  }
  filesByAccount.value.get(newAccountId).push(file)
}

async function processAllFiles() {
  if (filesByAccount.value.size === 0) return
  
  processing.value = true
  previewsByAccount.value.clear()
  
  try {
    // Process each account's files
    for (const [accountId, accountFiles] of filesByAccount.value) {
      const accountPreviews = []
      
      for (const file of accountFiles) {
        try {
          const res = await api.importCSV(accountId, file)
          accountPreviews.push(...res.preview)
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error)
          alert(`Error processing file ${file.name}: ${error.message}`)
        }
      }
      
      if (accountPreviews.length > 0) {
        previewsByAccount.value.set(accountId, accountPreviews)
      }
    }
    
    step.value = 3
    currentCategoryStep.value = 0
  } catch (error) {
    console.error('Error processing files:', error)
    alert('Error processing files: ' + error.message)
  } finally {
    processing.value = false
  }
}

function nextCategory() {
  if (hasMoreCategories.value) {
    currentCategoryStep.value++
  }
}

function previousCategory() {
  if (hasPreviousCategories.value) {
    currentCategoryStep.value--
  }
}

async function commitAllImports() {
  processing.value = true
  
  try {
    let totalImported = 0
    
    for (const [accountId, preview] of previewsByAccount.value) {
      const itemsToImport = preview.filter(x => !x.ignore)
      if (itemsToImport.length > 0) {
        await api.commitImport(itemsToImport)
        totalImported += itemsToImport.length
      }
    }
    
    // Clear everything
    files.value = []
    fileAnalysis.value = []
    filesByAccount.value.clear()
    previewsByAccount.value.clear()
    step.value = 4
    
    alert(`Import complete! ${totalImported} transactions imported.`)
    
    // Reset after a delay
    setTimeout(() => {
      step.value = 1
      currentCategoryStep.value = 0
    }, 2000)
    
  } catch (error) {
    console.error('Error committing imports:', error)
    alert('Error committing imports: ' + error.message)
  } finally {
    processing.value = false
  }
}

function resetImport() {
  files.value = []
  fileAnalysis.value = []
  filesByAccount.value.clear()
  previewsByAccount.value.clear()
  step.value = 1
  currentCategoryStep.value = 0
}
</script>

<template>
  <div class="import-wizard">
    <h2>Import Transactions</h2>
    
    <!-- Step 1: File Selection -->
    <div v-if="step === 1">
      <!-- Account Management -->
      <div class="account-section">
        <h3>Accounts</h3>
        <div class="account-controls">
          <input v-model="newAccount" placeholder="New account name" />
          <button @click="addAccount" :disabled="!newAccount">Add Account</button>
        </div>
      </div>

      <!-- Drag and Drop Zone -->
      <div 
        class="drop-zone"
        :class="{ 'drag-over': isDragOver }"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <div class="drop-content">
          <div class="drop-icon">📁</div>
          <h3>Drop CSV files here</h3>
          <p>Or click to select files</p>
          <input 
            type="file" 
            multiple 
            accept=".csv,text/csv" 
            @change="handleFileSelect"
            style="display: none;"
            ref="fileInput"
          />
          <button @click="$refs.fileInput.click()" class="select-files-btn">
            Select Files
          </button>
        </div>
      </div>

      <!-- File List -->
      <div v-if="files.length > 0" class="file-list-section">
        <h3>Selected Files ({{ totalFiles }} files)</h3>
        <div class="file-list">
          <div v-for="(file, index) in files" :key="index" class="file-item">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">({{ (file.size / 1024).toFixed(1) }} KB)</span>
            <button @click="removeFile(index)" class="remove-btn">×</button>
          </div>
        </div>
        
        <div class="action-buttons">
          <button @click="analyzeFiles" :disabled="processing || files.length === 0" class="btn btn-primary">
            {{ processing ? 'Analyzing...' : 'Analyze Files' }}
          </button>
          <button @click="resetImport" class="btn btn-secondary">Reset</button>
        </div>
      </div>
    </div>

    <!-- Step 2: Account Assignment -->
    <div v-if="step === 2">
      <div class="assignment-header">
        <h3>Assign Files to Accounts</h3>
        <button @click="resetImport" class="btn btn-secondary">Back to Files</button>
      </div>

      <div class="file-assignment">
        <div v-for="(analysis, index) in fileAnalysis" :key="index" class="file-assignment-item">
          <div class="file-info">
            <h4>{{ analysis.filename }}</h4>
            <p class="file-size">{{ (files[index].size / 1024).toFixed(1) }} KB</p>
            <div v-if="analysis.suggestedAccount" class="suggestion">
              <span class="suggestion-label">Suggested:</span>
              <span class="suggestion-account">{{ analysis.suggestedAccount.name }}</span>
              <span class="confidence">({{ Math.round(analysis.confidence * 100) }}% confidence)</span>
            </div>
            <div v-else class="suggestion">
              <span class="suggestion-label">Suggested name:</span>
              <span class="suggestion-name">{{ analysis.suggestedName }}</span>
            </div>
          </div>
          
          <div class="assignment-controls">
            <select 
              :value="getCurrentAccountId(index)" 
              @change="reassignFile(index, $event.target.value)"
              class="account-select"
            >
              <option value="">Select Account</option>
              <option v-for="account in props.accounts" :key="account.id" :value="account.id">
                {{ account.name }}
              </option>
            </select>
            <button @click="removeFile(index)" class="remove-btn">×</button>
          </div>
        </div>
      </div>

      <div class="action-buttons">
        <button @click="processAllFiles" :disabled="processing || !allFilesAssigned" class="btn btn-primary">
          {{ processing ? 'Processing...' : 'Process All Files' }}
        </button>
        <button @click="resetImport" class="btn btn-secondary">Cancel</button>
      </div>
    </div>

    <!-- Step 3: Review by Category -->
    <div v-if="step === 3">
      <div class="review-header">
        <h3>Review Transactions by Category</h3>
        <div class="category-navigation">
          <button @click="previousCategory" :disabled="!hasPreviousCategories" class="btn btn-secondary">
            Previous
          </button>
          <span class="category-step">
            {{ categoryStepNames[currentCategoryStep] }} 
            ({{ currentCategoryTransactions.length }} transactions)
          </span>
          <button @click="nextCategory" :disabled="!hasMoreCategories" class="btn btn-secondary">
            Next
          </button>
        </div>
      </div>

      <div v-if="currentCategoryTransactions.length > 0" class="category-review">
        <div class="table-container">
          <table class="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Name</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Category</th>
                <th>Note</th>
                <th>Ignore</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(tx, i) in currentCategoryTransactions" :key="i">
                <td>{{ tx.date }}</td>
                <td>{{ getAccountName(tx.account_id) }}</td>
                <td>{{ tx.name }}</td>
                <td class="amount">{{ Number(tx.amount).toFixed(2) }}</td>
                <td class="type">{{ tx.inflow ? 'Income' : 'Expense' }}</td>
                <td>
                  <select v-model="tx.category" class="category-select">
                    <option value="">(none)</option>
                    <option value="fixed_costs">Fixed Costs</option>
                    <option value="investments">Investments</option>
                    <option value="guilt_free">Guilt Free</option>
                    <option value="short_term_savings">Short Term Savings</option>
                  </select>
                </td>
                <td>
                  <input 
                    v-model="tx.note" 
                    type="text" 
                    placeholder="Add note..." 
                    class="note-input"
                  />
                </td>
                <td class="ignore">
                  <input type="checkbox" v-model="tx.ignore" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else class="no-transactions">
        <p>No transactions found for {{ categoryStepNames[currentCategoryStep] }}.</p>
      </div>

      <div class="action-buttons">
        <button 
          v-if="hasMoreCategories" 
          @click="nextCategory" 
          class="btn btn-secondary"
        >
          Next Category
        </button>
        <button 
          v-else
          @click="commitAllImports" 
          :disabled="processing" 
          class="btn btn-primary"
        >
          {{ processing ? 'Importing...' : 'Import All Transactions' }}
        </button>
        <button @click="resetImport" class="btn btn-secondary">Cancel</button>
      </div>
    </div>

    <!-- Step 4: Complete -->
    <div v-if="step === 4" class="complete-step">
      <div class="success-icon">✅</div>
      <h3>Import Complete!</h3>
      <p>All transactions have been successfully imported.</p>
    </div>
  </div>
</template>

<style scoped>
.import-wizard {
  max-width: 1000px;
  margin: 0 auto;
}

.account-section {
  margin-bottom: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.account-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 12px;
}

.account-controls input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1;
  max-width: 300px;
}

.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  background: #fafafa;
  transition: all 0.3s ease;
  cursor: pointer;
  margin: 24px 0;
}

.drop-zone:hover {
  border-color: #007bff;
  background: #f0f8ff;
}

.drop-zone.drag-over {
  border-color: #007bff;
  background: #e3f2fd;
  transform: scale(1.02);
}

.drop-content {
  pointer-events: none;
}

.drop-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.drop-zone h3 {
  margin: 0 0 8px 0;
  color: #333;
}

.drop-zone p {
  margin: 0 0 16px 0;
  color: #666;
}

.select-files-btn {
  pointer-events: all;
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s;
}

.select-files-btn:hover {
  background: #0056b3;
}

.file-assignment {
  margin-top: 24px;
  padding: 20px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}

.account-files {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.account-header h4 {
  margin: 0;
  color: #333;
}

.file-count {
  background: #007bff;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 4px;
}

.file-item .account-select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 14px;
  min-width: 120px;
}

.file-name {
  flex: 1;
  font-weight: 500;
  color: #333;
}

.file-size {
  color: #666;
  font-size: 14px;
}

.remove-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: #c82333;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.btn {
  padding: 12px 24px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border-color: #6c757d;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e9ecef;
}

.account-review {
  margin-bottom: 32px;
}

.account-review h4 {
  margin: 0 0 16px 0;
  color: #333;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.table-container {
  overflow-x: auto;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.transactions-table th {
  background: #f8f9fa;
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #e9ecef;
}

.transactions-table td {
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.transactions-table tr:hover {
  background: #f8f9fa;
}

.amount {
  text-align: right;
  font-weight: 500;
}

.type {
  text-align: center;
}

.category-select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.source {
  font-size: 12px;
  color: #666;
}

.ignore {
  text-align: center;
}

.complete-step {
  text-align: center;
  padding: 60px 20px;
}

.success-icon {
  font-size: 64px;
  margin-bottom: 24px;
}

.complete-step h3 {
  margin: 0 0 16px 0;
  color: #28a745;
  font-size: 24px;
}

.complete-step p {
  margin: 0;
  color: #666;
  font-size: 16px;
}

.file-list-section {
  margin-top: 24px;
  padding: 20px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}

.assignment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e9ecef;
}

.file-assignment {
  margin-bottom: 24px;
}

.file-assignment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-bottom: 12px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.file-info h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.file-info .file-size {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 14px;
}

.suggestion {
  font-size: 14px;
}

.suggestion-label {
  color: #666;
  font-weight: 500;
}

.suggestion-account {
  color: #007bff;
  font-weight: 600;
  margin: 0 8px;
}

.suggestion-name {
  color: #28a745;
  font-weight: 600;
  margin: 0 8px;
}

.confidence {
  color: #666;
  font-size: 12px;
}

.assignment-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-navigation {
  display: flex;
  align-items: center;
  gap: 16px;
}

.category-step {
  font-weight: 600;
  color: #333;
  padding: 8px 16px;
  background: #e3f2fd;
  border-radius: 20px;
  border: 1px solid #bbdefb;
}

.category-review {
  margin-bottom: 24px;
}

.no-transactions {
  text-align: center;
  padding: 40px;
  color: #666;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.note-input {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 14px;
  min-width: 150px;
}
</style>
