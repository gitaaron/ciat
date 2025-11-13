
<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import ImportWizard from './components/ImportWizard/ImportWizard.vue'
import TransactionsTable from './components/TransactionsTable/TransactionsTable.vue'
import Reports from './components/Reports/Reports.vue'
import DatabaseVersions from './components/DatabaseVersions/DatabaseVersions.vue'
import NewCategoryWizard from './components/NewCategoryWizard/NewCategoryWizard.vue'
import RuleManager from './components/RuleManager/RuleManager.vue'
import GlobalNotifications from './components/GlobalNotifications.vue'
import api from './components/api.js'

const accounts = ref([])
const selected = ref('reports')
const hasTransactions = ref(false)
const showNewCategoryWizard = ref(false)
const transactionsTableRef = ref(null)
const reportsRef = ref(null)
const ruleManagerRef = ref(null)
const ruleToEdit = ref(null)

// Debug mode - can be enabled via URL parameter ?debug=true
const isDebugMode = ref(false)
const debugStep = ref(1) // 1: file selection, 2: account assignment, 3: rules review, 4: transaction review, 5: complete

async function loadAccounts() {
  accounts.value = await api.getAccounts()
}

async function checkTransactions() {
  try {
    const transactions = await api.listTransactions()
    hasTransactions.value = transactions.length > 0
    // If no transactions exist, default to import tab
    if (!hasTransactions.value) {
      selected.value = 'import'
    } else {
      // If transactions exist, default to reports tab
      selected.value = 'reports'
    }
  } catch (error) {
    console.error('Error checking transactions:', error)
    hasTransactions.value = false
    selected.value = 'import'
  }
}


async function handleAccountsUpdated() {
  await loadAccounts()
}

async function handleRulesReapplied() {
  // Reload transactions and reports when rules are reapplied
  if (transactionsTableRef.value && transactionsTableRef.value.loadTransactions) {
    await transactionsTableRef.value.loadTransactions()
  }
  if (reportsRef.value && reportsRef.value.refresh) {
    await reportsRef.value.refresh()
  }
}

async function handleCategoriesUpdated() {
  // Refresh reports when transaction categories are updated
  if (reportsRef.value && reportsRef.value.refresh) {
    await reportsRef.value.refresh()
  }
}

async function handleOpenRule(rule) {
  // Navigate to rules tab
  selected.value = 'manage-rules'
  // Set rule to edit
  ruleToEdit.value = rule
  // Wait for next tick to ensure RuleManager is rendered
  await nextTick()
  // Use a small delay to ensure the component is fully mounted
  setTimeout(() => {
    if (ruleManagerRef.value && typeof ruleManagerRef.value.editRule === 'function') {
      ruleManagerRef.value.editRule(rule)
    }
  }, 150)
}

async function handleImportComplete() {
  await checkTransactions()
  // Navigate to reports tab after import completion
  selected.value = 'reports'
  // Reload transactions and reports after import
  if (transactionsTableRef.value && transactionsTableRef.value.loadTransactions) {
    await transactionsTableRef.value.loadTransactions()
  }
  if (reportsRef.value && reportsRef.value.refresh) {
    await reportsRef.value.refresh()
  }
}

// Initialize debug mode from URL parameters
function initializeDebugMode() {
  const urlParams = new URLSearchParams(window.location.search)
  isDebugMode.value = urlParams.get('debug') === 'true'
  
  if (isDebugMode.value) {
    console.log('Debug mode enabled')
    // In debug mode, always show import tab and set up mock data
    selected.value = 'import'
    hasTransactions.value = false
    // Add mock accounts for testing
    accounts.value = [
      { id: 1, name: 'Test Account' }
    ]
  }
}

onMounted(async () => {
  initializeDebugMode()
  
  if (!isDebugMode.value) {
    await loadAccounts()
    await checkTransactions()
  }
})
</script>

<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-app-bar-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-wallet</v-icon>
        Can I Afford That
        <v-chip v-if="isDebugMode" color="orange" class="ml-2" small>DEBUG MODE</v-chip>
      </v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn icon @click="selected = 'versions'" title="Database Versions">
        <v-icon>mdi-cog</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container max-width="1200" class="pa-4">
        <v-tabs v-if="hasTransactions" v-model="selected" class="mb-4">
          <v-tab value="reports">
            <v-icon left>mdi-chart-pie</v-icon>
            Reports
          </v-tab>
          <v-tab value="transactions">
            <v-icon left>mdi-format-list-bulleted</v-icon>
            Transactions
          </v-tab>
          <v-tab value="manage-rules">
            <v-icon left>mdi-cog</v-icon>
            Manage Rules
          </v-tab>
          <v-tab value="import">
            <v-icon left>mdi-upload</v-icon>
            Import
          </v-tab>
        </v-tabs>

        <v-window v-model="selected">
          <v-window-item value="import">
            <v-card v-if="!hasTransactions" class="mb-4" color="primary" dark>
              <v-card-text class="text-center pa-8">
                <h2 class="text-h4 mb-2">Welcome to CIAT!</h2>
                <p class="text-h6">Get started by importing transactions to begin tracking your finances.</p>
              </v-card-text>
            </v-card>
            
            <!-- Debug Controls -->
            <v-card v-if="isDebugMode" class="mb-4" color="orange" dark>
              <v-card-title>
                <v-icon left>mdi-bug</v-icon>
                Debug Controls
              </v-card-title>
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-btn color="white" @click="debugStep = 1" :disabled="debugStep === 1">
                      Step 1: File Selection
                    </v-btn>
                    <v-btn color="white" @click="debugStep = 2" :disabled="debugStep === 2" class="ml-2">
                      Step 2: Account Assignment
                    </v-btn>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-btn color="white" @click="debugStep = 3" :disabled="debugStep === 3">
                      Step 3: Rules Review
                    </v-btn>
                    <v-btn color="white" @click="debugStep = 4" :disabled="debugStep === 4" class="ml-2">
                      Step 4: Transaction Review
                    </v-btn>
                  </v-col>
                </v-row>
                <div class="mt-2">
                  <v-chip color="white" class="mr-2">Current Step: {{ debugStep }}</v-chip>
                  <v-chip color="white">Using Stub Backend</v-chip>
                </div>
              </v-card-text>
            </v-card>
            
            <ImportWizard 
              :accounts="accounts" 
              :debug-mode="isDebugMode"
              :debug-step="debugStep"
              @refresh-accounts="loadAccounts" 
              @import-complete="handleImportComplete" 
            />
          </v-window-item>

          <v-window-item value="transactions">
            <TransactionsTable 
              ref="transactionsTableRef" 
              :accounts="accounts"
              @open-rule="handleOpenRule"
              @categories-updated="handleCategoriesUpdated"
            />
          </v-window-item>

          <v-window-item value="reports">
            <Reports ref="reportsRef" @navigate-to-import="selected = 'import'" />
          </v-window-item>

          <v-window-item value="manage-rules">
            <RuleManager 
              ref="ruleManagerRef"
              @create-new="showNewCategoryWizard = true" 
              @rules-reapplied="handleRulesReapplied"
            />
            <NewCategoryWizard 
              v-if="showNewCategoryWizard" 
              @close="showNewCategoryWizard = false" 
            />
          </v-window-item>

          <v-window-item value="versions">
            <DatabaseVersions />
          </v-window-item>
        </v-window>
      </v-container>
    </v-main>
    
    <!-- Global Notifications -->
    <GlobalNotifications />
  </v-app>
</template>

<style>
/* Global font family for all text elements */
* {
  font-family: 'Poppins', sans-serif !important;
}

/* Ensure Vuetify components use Poppins */
.v-application {
  font-family: 'Poppins', sans-serif !important;
}

/* Apply to all text elements */
h1, h2, h3, h4, h5, h6, p, span, div, button, input, textarea, label, a {
  font-family: 'Poppins', sans-serif !important;
}

/* Vuetify specific overrides */
.v-btn, .v-card, .v-list, .v-tab, .v-chip, .v-text-field, .v-select, .v-autocomplete {
  font-family: 'Poppins', sans-serif !important;
}
</style>

