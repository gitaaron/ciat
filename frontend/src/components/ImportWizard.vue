
<script setup>
import { ref, computed } from 'vue'
import api from './api.js'

const props = defineProps({ accounts: Array })
const emit = defineEmits(['refresh-accounts'])

const newAccount = ref('')
const step = ref(1) // 1: file selection, 2: review, 3: complete
const filesByAccount = ref(new Map()) // Map<accountId, File[]>
const previewsByAccount = ref(new Map()) // Map<accountId, preview[]>
const isDragOver = ref(false)
const processing = ref(false)

const totalFiles = computed(() => {
  let total = 0
  for (const files of filesByAccount.value.values()) {
    total += files.length
  }
  return total
})

const totalTransactions = computed(() => {
  let total = 0
  for (const preview of previewsByAccount.value.values()) {
    total += preview.length
  }
  return total
})

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
  
  const files = Array.from(e.dataTransfer.files).filter(file => 
    file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
  )
  
  if (files.length === 0) {
    alert('Please drop CSV files only')
    return
  }
  
  // For now, we'll need to ask user to assign files to accounts
  // In a more advanced version, we could try to auto-detect from filename
  assignFilesToAccounts(files)
}

function assignFilesToAccounts(files) {
  // Clear existing files
  filesByAccount.value.clear()
  
  // If no accounts exist, create a default assignment
  if (props.accounts.length === 0) {
    alert('Please create an account first before importing files.')
    return
  }
  
  // For now, assign all files to the first account
  // In a more advanced version, we could:
  // 1. Auto-detect from filename patterns
  // 2. Show a dialog to let user assign each file
  // 3. Use file metadata or content analysis
  const defaultAccountId = props.accounts[0].id
  
  for (const file of files) {
    if (!filesByAccount.value.has(defaultAccountId)) {
      filesByAccount.value.set(defaultAccountId, [])
    }
    filesByAccount.value.get(defaultAccountId).push(file)
  }
}

function removeFile(accountId, fileIndex) {
  const files = filesByAccount.value.get(accountId)
  if (files) {
    files.splice(fileIndex, 1)
    if (files.length === 0) {
      filesByAccount.value.delete(accountId)
    }
  }
}

function assignFileToAccount(file, accountId) {
  if (!filesByAccount.value.has(accountId)) {
    filesByAccount.value.set(accountId, [])
  }
  filesByAccount.value.get(accountId).push(file)
}

function reassignFile(file, fromAccountId, toAccountId, fileIndex) {
  // Remove from current account
  const fromFiles = filesByAccount.value.get(fromAccountId)
  if (fromFiles) {
    fromFiles.splice(fileIndex, 1)
    if (fromFiles.length === 0) {
      filesByAccount.value.delete(fromAccountId)
    }
  }
  
  // Add to new account
  if (!filesByAccount.value.has(toAccountId)) {
    filesByAccount.value.set(toAccountId, [])
  }
  filesByAccount.value.get(toAccountId).push(file)
}

async function processAllFiles() {
  if (filesByAccount.value.size === 0) return
  
  processing.value = true
  previewsByAccount.value.clear()
  
  try {
    // Process each account's files
    for (const [accountId, files] of filesByAccount.value) {
      const accountPreviews = []
      
      for (const file of files) {
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
    
    step.value = 2
  } catch (error) {
    console.error('Error processing files:', error)
    alert('Error processing files: ' + error.message)
  } finally {
    processing.value = false
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
    filesByAccount.value.clear()
    previewsByAccount.value.clear()
    step.value = 3
    
    alert(`Import complete! ${totalImported} transactions imported.`)
    
    // Reset after a delay
    setTimeout(() => {
      step.value = 1
    }, 2000)
    
  } catch (error) {
    console.error('Error committing imports:', error)
    alert('Error committing imports: ' + error.message)
  } finally {
    processing.value = false
  }
}

function resetImport() {
  filesByAccount.value.clear()
  previewsByAccount.value.clear()
  step.value = 1
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
            @change="e => assignFilesToAccounts(Array.from(e.target.files))"
            style="display: none;"
            ref="fileInput"
          />
          <button @click="$refs.fileInput.click()" class="select-files-btn">
            Select Files
          </button>
        </div>
      </div>

      <!-- File Assignment -->
      <div v-if="filesByAccount.size > 0" class="file-assignment">
        <h3>Files to Import ({{ totalFiles }} files)</h3>
        
        <div v-for="[accountId, files] in filesByAccount" :key="accountId" class="account-files">
          <div class="account-header">
            <h4>{{ props.accounts.find(a => a.id === accountId)?.name || 'Unknown Account' }}</h4>
            <span class="file-count">{{ files.length }} file(s)</span>
          </div>
          
          <div class="file-list">
            <div v-for="(file, index) in files" :key="index" class="file-item">
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">({{ (file.size / 1024).toFixed(1) }} KB)</span>
              <select 
                :value="accountId" 
                @change="reassignFile(file, accountId, $event.target.value, index)"
                class="account-select"
              >
                <option v-for="account in props.accounts" :key="account.id" :value="account.id">
                  {{ account.name }}
                </option>
              </select>
              <button @click="removeFile(accountId, index)" class="remove-btn">×</button>
            </div>
          </div>
        </div>

        <div class="action-buttons">
          <button @click="processAllFiles" :disabled="processing || totalFiles === 0" class="btn btn-primary">
            {{ processing ? 'Processing...' : 'Process All Files' }}
          </button>
          <button @click="resetImport" class="btn btn-secondary">Reset</button>
        </div>
      </div>
    </div>

    <!-- Step 2: Review -->
    <div v-if="step === 2">
      <div class="review-header">
        <h3>Review Transactions ({{ totalTransactions }} total)</h3>
        <button @click="resetImport" class="btn btn-secondary">Back to Files</button>
      </div>

      <div v-for="[accountId, preview] in previewsByAccount" :key="accountId" class="account-review">
        <h4>{{ props.accounts.find(a => a.id === accountId)?.name || 'Unknown Account' }} ({{ preview.length }} transactions)</h4>
        
        <div class="table-container">
          <table class="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Category</th>
                <th>Source</th>
                <th>Ignore</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in preview" :key="i">
                <td>{{ r.date }}</td>
                <td>{{ r.name }}</td>
                <td class="amount">{{ Number(r.amount).toFixed(2) }}</td>
                <td class="type">{{ r.inflow ? 'Income' : 'Expense' }}</td>
                <td>
                  <select v-model="r.category" class="category-select">
                    <option value="">(none)</option>
                    <option value="guilt_free">guilt_free</option>
                    <option value="short_term_savings">short_term_savings</option>
                    <option value="fixed_costs">fixed_costs</option>
                    <option value="investments">investments</option>
                  </select>
                </td>
                <td class="source">{{ r.category_source }}</td>
                <td class="ignore">
                  <input type="checkbox" v-model="r.ignore" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="action-buttons">
        <button @click="commitAllImports" :disabled="processing" class="btn btn-primary">
          {{ processing ? 'Importing...' : 'Import All Transactions' }}
        </button>
        <button @click="resetImport" class="btn btn-secondary">Cancel</button>
      </div>
    </div>

    <!-- Step 3: Complete -->
    <div v-if="step === 3" class="complete-step">
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
</style>
