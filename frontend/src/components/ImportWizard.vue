
<script setup>
import { ref, computed, watch } from 'vue'
import api from './api.js'

const props = defineProps({ accounts: Array })
const emit = defineEmits(['refresh-accounts', 'import-complete'])

const newAccount = ref('')
const step = ref(1) // 1: file selection, 2: account assignment, 3: review, 4: complete
const creating = ref(false)
const createError = ref('')
const editingAccount = ref(null)
const editAccountName = ref('')
const editError = ref('')
const updating = ref(false)
const deleteDialog = ref(false)
const accountToDelete = ref(null)
const deleting = ref(false)
const deleteError = ref('')
const files = ref([])
const fileAnalysis = ref([])
const filesByAccount = ref(new Map()) // Map<accountId, File[]>
const previewsByAccount = ref(new Map()) // Map<accountId, preview[]>
const isDragOver = ref(false)
const processing = ref(false)
const currentCategoryStep = ref(0) // 0: fixed, 1: investments, 2: guilt_free, 3: short_term
const categorySteps = ['fixed_costs', 'investments', 'guilt_free', 'short_term_savings']
const categoryStepNames = ['Fixed Costs', 'Investments', 'Guilt Free', 'Short Term Savings']

// Validation rules for account names
const accountNameRules = [
  v => !!v || 'Account name is required',
  v => (v && v.trim().length >= 2) || 'Account name must be at least 2 characters',
  v => (v && v.trim().length <= 50) || 'Account name must be less than 50 characters'
]

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
  if (!newAccount.value.trim()) return
  
  creating.value = true
  createError.value = ''
  
  try {
    await api.createAccount(newAccount.value.trim())
    newAccount.value = ''
    await emit('refresh-accounts')
  } catch (error) {
    createError.value = error.response?.data?.error || 'Failed to create account'
  } finally {
    creating.value = false
  }
}

function startEdit(account) {
  editingAccount.value = account.id
  editAccountName.value = account.name
  editError.value = ''
}

function cancelEdit() {
  editingAccount.value = null
  editAccountName.value = ''
  editError.value = ''
}

async function saveAccount(accountId) {
  if (!editAccountName.value.trim()) return
  
  updating.value = true
  editError.value = ''
  
  try {
    await api.updateAccount(accountId, editAccountName.value.trim())
    editingAccount.value = null
    editAccountName.value = ''
    await emit('refresh-accounts')
  } catch (error) {
    editError.value = error.response?.data?.error || 'Failed to update account'
  } finally {
    updating.value = false
  }
}

function confirmDelete(account) {
  accountToDelete.value = account
  deleteError.value = ''
  deleteDialog.value = true
}

async function deleteAccount() {
  if (!accountToDelete.value) return
  
  deleting.value = true
  deleteError.value = ''
  
  try {
    await api.deleteAccount(accountToDelete.value.id)
    deleteDialog.value = false
    accountToDelete.value = null
    await emit('refresh-accounts')
  } catch (error) {
    deleteError.value = error.response?.data?.error || 'Failed to delete account'
  } finally {
    deleting.value = false
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
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
    alert('Please drop a CSV or QFX file only')
    return
  }
  
  if (droppedFiles.length > 1) {
    alert('Please drop only one file at a time')
    return
  }
  
  files.value = [droppedFiles[0]] // Only keep the first file
  analyzeFiles()
}

function handleFileSelect(e) {
  const selectedFiles = Array.from(e.target.files).filter(file => {
    const filename = file.name.toLowerCase()
    return filename.endsWith('.csv') || filename.endsWith('.qfx') || filename.endsWith('.ofx')
  })
  
  if (selectedFiles.length === 0) {
    alert('Please select a CSV or QFX file only')
    return
  }
  
  if (selectedFiles.length > 1) {
    alert('Please select only one file at a time')
    return
  }
  
  files.value = [selectedFiles[0]] // Only keep the first file
  analyzeFiles()
}

async function analyzeFiles() {
  if (files.value.length === 0) return
  
  processing.value = true
  try {
    const result = await api.analyzeFiles(files.value)
    fileAnalysis.value = result.analysis
    
    // Auto-assign file based on suggestions
    filesByAccount.value.clear()
    const analysis = fileAnalysis.value[0] // Only one file now
    const file = files.value[0] // Only one file now
    if (file && analysis) {
      const accountId = analysis.suggestedAccount?.id || props.accounts[0]?.id
      if (accountId) {
        filesByAccount.value.set(accountId, [file])
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
  files.value = []
  fileAnalysis.value = []
  filesByAccount.value.clear()
}

function reassignFile(fileIndex, newAccountId) {
  const file = files.value[fileIndex]
  
  // Clear current assignment and assign to new account
  filesByAccount.value.clear()
  filesByAccount.value.set(newAccountId, [file])
}

async function processAllFiles() {
  if (filesByAccount.value.size === 0) return
  
  processing.value = true
  previewsByAccount.value.clear()
  
  try {
    // Process the single file
    for (const [accountId, accountFiles] of filesByAccount.value) {
      const file = accountFiles[0] // Only one file now
      try {
        const res = await api.importCSV(accountId, file)
        previewsByAccount.value.set(accountId, res.preview)
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error)
        alert(`Error processing file ${file.name}: ${error.message}`)
      }
    }
    
    step.value = 3
    currentCategoryStep.value = 0
  } catch (error) {
    console.error('Error processing file:', error)
    alert('Error processing file: ' + error.message)
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
    <!-- Account Management Section (Always Visible) -->
    <v-card class="mb-4" variant="outlined">
      <v-card-title class="text-h6">
        <v-icon left>mdi-wallet</v-icon>
        Account Management
      </v-card-title>
      
      <v-card-text>
        <!-- Create New Account Section -->
        <v-card class="mb-4" variant="outlined">
          <v-card-title class="text-subtitle-1">Create New Account</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="addAccount" ref="createForm">
              <v-row>
                <v-col cols="12" md="8">
                  <v-text-field
                    v-model="newAccount"
                    label="Account Name"
                    :rules="accountNameRules"
                    :error-messages="createError"
                    @input="createError = ''"
                    variant="outlined"
                    density="compact"
                    required
                  />
                </v-col>
                <v-col cols="12" md="4" class="d-flex align-center">
                  <v-btn
                    type="submit"
                    color="primary"
                    :loading="creating"
                    :disabled="!newAccount.trim()"
                    block
                  >
                    <v-icon left>mdi-plus</v-icon>
                    Create Account
                  </v-btn>
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
        </v-card>

        <!-- Existing Accounts List -->
        <v-card variant="outlined">
          <v-card-title class="text-subtitle-1">Existing Accounts</v-card-title>
          <v-card-text>
            <v-alert
              v-if="accounts.length === 0"
              type="info"
              variant="tonal"
              class="mb-4"
            >
              No accounts created yet. Create your first account above to get started.
            </v-alert>
            
            <v-list v-else>
              <v-list-item
                v-for="account in accounts"
                :key="account.id"
                class="px-0"
              >
                <template v-slot:prepend>
                  <v-icon>mdi-bank</v-icon>
                </template>
                
                <v-list-item-title>
                  <v-text-field
                    v-if="editingAccount === account.id"
                    v-model="editAccountName"
                    :rules="accountNameRules"
                    :error-messages="editError"
                    @keyup.enter="saveAccount(account.id)"
                    @keyup.escape="cancelEdit"
                    autofocus
                    density="compact"
                    variant="outlined"
                  />
                  <span v-else>{{ account.name }}</span>
                </v-list-item-title>
                
                <v-list-item-subtitle>
                  Created: {{ formatDate(account.created_at) }}
                </v-list-item-subtitle>
                
                <template v-slot:append>
                  <div v-if="editingAccount === account.id" class="d-flex">
                    <v-btn
                      icon="mdi-check"
                      size="small"
                      color="success"
                      @click="saveAccount(account.id)"
                      :loading="updating"
                      class="mr-2"
                    />
                    <v-btn
                      icon="mdi-close"
                      size="small"
                      color="error"
                      @click="cancelEdit"
                    />
                  </div>
                  <div v-else class="d-flex">
                    <v-btn
                      icon="mdi-pencil"
                      size="small"
                      @click="startEdit(account)"
                      class="mr-2"
                    />
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      color="error"
                      @click="confirmDelete(account)"
                    />
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>

    <!-- Import Transactions Section -->
    <v-card>
      <v-card-title class="text-h5">
        <v-icon left>mdi-upload</v-icon>
        Import Transactions
      </v-card-title>
      
      <!-- Step 1: File Selection -->
      <v-card-text v-if="step === 1">

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
          <h3 class="text-h6 mb-2">Drop CSV or QFX file here</h3>
          <p class="text-body-2 mb-4">Or click to select file</p>
          <input 
            type="file" 
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
            Select File
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- File List -->
      <v-card v-if="files.length > 0" variant="outlined">
        <v-card-title class="text-h6">
          <v-icon left>mdi-file-document</v-icon>
          Selected File ({{ totalFiles }} file)
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
        Assign File to Account
        <v-spacer />
        <v-btn @click="resetImport" color="secondary" variant="outlined">
          <v-icon left>mdi-arrow-left</v-icon>
          Back to File
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
            {{ processing ? 'Processing...' : 'Process File' }}
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

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon left color="error">mdi-alert-circle</v-icon>
          Confirm Account Deletion
        </v-card-title>
        
        <v-card-text>
          <p>Are you sure you want to delete the account <strong>"{{ accountToDelete?.name }}"</strong>?</p>
          <v-alert
            v-if="deleteError"
            type="error"
            variant="tonal"
            class="mt-4"
          >
            {{ deleteError }}
          </v-alert>
          <v-alert
            type="warning"
            variant="tonal"
            class="mt-4"
          >
            <strong>Warning:</strong> This action cannot be undone. If this account has transactions, you'll need to delete or reassign them first.
          </v-alert>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="deleteDialog = false"
            :disabled="deleting"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            @click="deleteAccount"
            :loading="deleting"
          >
            <v-icon left>mdi-delete</v-icon>
            Delete Account
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
.v-list-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.v-list-item:last-child {
  border-bottom: none;
}
</style>
