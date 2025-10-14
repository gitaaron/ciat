
<script setup>
import { ref, computed, watch } from 'vue'
import api from './api.js'

const props = defineProps({ accounts: Array })
const emit = defineEmits(['refresh-accounts', 'import-complete'])

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

function getFileFormat(filename) {
  const ext = filename.toLowerCase().split('.').pop()
  switch (ext) {
    case 'csv':
      return 'CSV'
    case 'qfx':
    case 'ofx':
      return 'QFX'
    default:
      return ext.toUpperCase()
  }
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
  
  const droppedFiles = Array.from(e.dataTransfer.files).filter(file => {
    const filename = file.name.toLowerCase()
    return filename.endsWith('.csv') || filename.endsWith('.qfx') || filename.endsWith('.ofx')
  })
  
  if (droppedFiles.length === 0) {
    alert('Please drop CSV or QFX files only')
    return
  }
  
  files.value = [...files.value, ...droppedFiles]
  analyzeFiles()
}

function handleFileSelect(e) {
  const selectedFiles = Array.from(e.target.files).filter(file => {
    const filename = file.name.toLowerCase()
    return filename.endsWith('.csv') || filename.endsWith('.qfx') || filename.endsWith('.ofx')
  })
  
  if (selectedFiles.length === 0) {
    alert('Please select CSV or QFX files only')
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
    
    // Emit import complete event
    emit('import-complete')
    
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
  <v-card>
    <v-card-title class="text-h5">
      <v-icon left>mdi-upload</v-icon>
      Import Transactions
    </v-card-title>
    
    <!-- Step 1: File Selection -->
    <v-card-text v-if="step === 1">
      <!-- Account Management -->
      <v-card class="mb-4" variant="outlined">
        <v-card-title class="text-h6">
          <v-icon left>mdi-account</v-icon>
          Accounts
        </v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="8">
              <v-text-field
                v-model="newAccount"
                label="New account name"
                variant="outlined"
                density="compact"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-btn
                @click="addAccount"
                :disabled="!newAccount"
                color="primary"
                block
              >
                <v-icon left>mdi-plus</v-icon>
                Add Account
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Drag and Drop Zone -->
      <v-card 
        class="mb-4"
        :class="{ 'border-primary': isDragOver }"
        variant="outlined"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
        style="cursor: pointer;"
      >
        <v-card-text class="text-center pa-8">
          <v-icon size="64" color="primary" class="mb-4">mdi-file-upload</v-icon>
          <h3 class="text-h6 mb-2">Drop CSV or QFX files here</h3>
          <p class="text-body-2 mb-4">Or click to select files</p>
          <input 
            type="file" 
            multiple 
            accept=".csv,.qfx,.ofx,text/csv" 
            @change="handleFileSelect"
            style="display: none;"
            ref="fileInput"
          />
          <v-btn
            @click="$refs.fileInput.click()"
            color="primary"
            variant="outlined"
          >
            <v-icon left>mdi-folder-open</v-icon>
            Select Files
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- File List -->
      <v-card v-if="files.length > 0" variant="outlined">
        <v-card-title class="text-h6">
          <v-icon left>mdi-file-document</v-icon>
          Selected Files ({{ totalFiles }} files)
        </v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item
              v-for="(file, index) in files"
              :key="index"
              class="px-0"
            >
              <template v-slot:prepend>
                <v-icon color="primary">mdi-file</v-icon>
              </template>
              
              <v-list-item-title>{{ file.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ (file.size / 1024).toFixed(1) }} KB • {{ getFileFormat(file.name) }}
              </v-list-item-subtitle>
              
              <template v-slot:append>
                <v-btn
                  @click="removeFile(index)"
                  icon="mdi-close"
                  color="error"
                  variant="text"
                  size="small"
                />
              </template>
            </v-list-item>
          </v-list>
          
          <v-row class="mt-4">
            <v-col cols="12" sm="6">
              <v-btn
                @click="analyzeFiles"
                :disabled="processing || files.length === 0"
                :loading="processing"
                color="primary"
                block
              >
                <v-icon left>mdi-magnify</v-icon>
                {{ processing ? 'Analyzing...' : 'Analyze Files' }}
              </v-btn>
            </v-col>
            <v-col cols="12" sm="6">
              <v-btn
                @click="resetImport"
                color="secondary"
                variant="outlined"
                block
              >
                <v-icon left>mdi-refresh</v-icon>
                Reset
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-card-text>

    <!-- Step 2: Account Assignment -->
    <v-card-text v-if="step === 2">
      <v-card-title class="text-h6 mb-4">
        <v-icon left>mdi-account-arrow-right</v-icon>
        Assign Files to Accounts
        <v-spacer />
        <v-btn @click="resetImport" color="secondary" variant="outlined">
          <v-icon left>mdi-arrow-left</v-icon>
          Back to Files
        </v-btn>
      </v-card-title>

      <v-card variant="outlined" class="mb-4">
        <v-card-text>
          <v-list>
            <v-list-item
              v-for="(analysis, index) in fileAnalysis"
              :key="index"
              class="px-0"
            >
              <template v-slot:prepend>
                <v-icon color="primary">mdi-file</v-icon>
              </template>
              
              <v-list-item-title>{{ analysis.filename }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ (files[index].size / 1024).toFixed(1) }} KB • {{ analysis.formatDisplayName || getFileFormat(analysis.filename) }}
                <br>
                <span v-if="analysis.suggestedAccount" class="text-primary">
                  <strong>Suggested:</strong> {{ analysis.suggestedAccount.name }} 
                  ({{ Math.round(analysis.confidence * 100) }}% confidence)
                </span>
                <span v-else class="text-success">
                  <strong>Suggested name:</strong> {{ analysis.suggestedName }}
                </span>
              </v-list-item-subtitle>
              
              <template v-slot:append>
                <v-row class="align-center">
                  <v-col cols="auto">
                    <v-select
                      :model-value="getCurrentAccountId(index)"
                      @update:model-value="reassignFile(index, $event)"
                      :items="props.accounts"
                      item-title="name"
                      item-value="id"
                      label="Select Account"
                      variant="outlined"
                      density="compact"
                      style="min-width: 200px;"
                    />
                  </v-col>
                  <v-col cols="auto">
                    <v-btn
                      @click="removeFile(index)"
                      icon="mdi-close"
                      color="error"
                      variant="text"
                      size="small"
                    />
                  </v-col>
                </v-row>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>

      <v-row>
        <v-col cols="12" sm="6">
          <v-btn
            @click="processAllFiles"
            :disabled="processing || !allFilesAssigned"
            :loading="processing"
            color="primary"
            block
          >
            <v-icon left>mdi-cog</v-icon>
            {{ processing ? 'Processing...' : 'Process All Files' }}
          </v-btn>
        </v-col>
        <v-col cols="12" sm="6">
          <v-btn
            @click="resetImport"
            color="secondary"
            variant="outlined"
            block
          >
            <v-icon left>mdi-cancel</v-icon>
            Cancel
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>

    <!-- Step 3: Review by Category -->
    <v-card-text v-if="step === 3">
      <v-card-title class="text-h6 mb-4">
        <v-icon left>mdi-eye</v-icon>
        Review Transactions by Category
      </v-card-title>

      <v-card variant="outlined" class="mb-4">
        <v-card-text>
          <v-row class="align-center mb-4">
            <v-col cols="auto">
              <v-btn
                @click="previousCategory"
                :disabled="!hasPreviousCategories"
                color="secondary"
                variant="outlined"
              >
                <v-icon left>mdi-chevron-left</v-icon>
                Previous
              </v-btn>
            </v-col>
            <v-col>
              <v-chip
                color="primary"
                variant="outlined"
                size="large"
                class="text-h6"
              >
                {{ categoryStepNames[currentCategoryStep] }} 
                ({{ currentCategoryTransactions.length }} transactions)
              </v-chip>
            </v-col>
            <v-col cols="auto">
              <v-btn
                @click="nextCategory"
                :disabled="!hasMoreCategories"
                color="secondary"
                variant="outlined"
              >
                Next
                <v-icon right>mdi-chevron-right</v-icon>
              </v-btn>
            </v-col>
          </v-row>

          <v-data-table
            v-if="currentCategoryTransactions.length > 0"
            :headers="[
              { title: 'Date', key: 'date', sortable: true },
              { title: 'Account', key: 'account', sortable: true },
              { title: 'Name', key: 'name', sortable: true },
              { title: 'Amount', key: 'amount', sortable: true },
              { title: 'Type', key: 'type', sortable: true },
              { title: 'Category', key: 'category', sortable: false },
              { title: 'Note', key: 'note', sortable: false },
              { title: 'Ignore', key: 'ignore', sortable: false }
            ]"
            :items="currentCategoryTransactions"
            class="elevation-1"
          >
            <template v-slot:item.account="{ item }">
              {{ getAccountName(item.account_id) }}
            </template>
            
            <template v-slot:item.amount="{ item }">
              <span class="font-weight-medium">
                ${{ Number(item.amount).toFixed(2) }}
              </span>
            </template>
            
            <template v-slot:item.type="{ item }">
              <v-chip
                :color="item.inflow ? 'success' : 'error'"
                size="small"
                variant="outlined"
              >
                {{ item.inflow ? 'Income' : 'Expense' }}
              </v-chip>
            </template>
            
            <template v-slot:item.category="{ item }">
              <v-select
                v-model="item.category"
                :items="[
                  { title: '(none)', value: '' },
                  { title: 'Fixed Costs', value: 'fixed_costs' },
                  { title: 'Investments', value: 'investments' },
                  { title: 'Guilt Free', value: 'guilt_free' },
                  { title: 'Short Term Savings', value: 'short_term_savings' }
                ]"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="compact"
                hide-details
                style="min-width: 150px;"
              />
            </template>
            
            <template v-slot:item.note="{ item }">
              <v-text-field
                v-model="item.note"
                placeholder="Add note..."
                variant="outlined"
                density="compact"
                hide-details
                style="min-width: 150px;"
              />
            </template>
            
            <template v-slot:item.ignore="{ item }">
              <v-checkbox
                v-model="item.ignore"
                hide-details
                density="compact"
              />
            </template>
          </v-data-table>

          <v-alert
            v-else
            type="info"
            variant="outlined"
            class="text-center"
          >
            No transactions found for {{ categoryStepNames[currentCategoryStep] }}.
          </v-alert>
        </v-card-text>
      </v-card>

      <v-row>
        <v-col cols="12" sm="4">
          <v-btn
            v-if="hasMoreCategories"
            @click="nextCategory"
            color="secondary"
            variant="outlined"
            block
          >
            <v-icon left>mdi-chevron-right</v-icon>
            Next Category
          </v-btn>
          <v-btn
            v-else
            @click="commitAllImports"
            :disabled="processing"
            :loading="processing"
            color="primary"
            block
          >
            <v-icon left>mdi-import</v-icon>
            {{ processing ? 'Importing...' : 'Import All Transactions' }}
          </v-btn>
        </v-col>
        <v-col cols="12" sm="4">
          <v-btn
            @click="resetImport"
            color="secondary"
            variant="outlined"
            block
          >
            <v-icon left>mdi-cancel</v-icon>
            Cancel
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>

    <!-- Step 4: Complete -->
    <v-card-text v-if="step === 4">
      <v-card variant="outlined" class="text-center">
        <v-card-text class="pa-8">
          <v-icon size="80" color="success" class="mb-4">mdi-check-circle</v-icon>
          <h3 class="text-h4 mb-2 text-success">Import Complete!</h3>
          <p class="text-h6">All transactions have been successfully imported.</p>
        </v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

