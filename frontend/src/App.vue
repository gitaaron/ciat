
<script setup>
import { ref, onMounted, computed } from 'vue'
import ImportWizard from './components/ImportWizard.vue'
import TransactionsTable from './components/TransactionsTable.vue'
import PieChart from './components/PieChart.vue'
import LineChart from './components/LineChart.vue'
import DatabaseVersions from './components/DatabaseVersions.vue'
import NewCategoryWizard from './components/NewCategoryWizard.vue'
import RuleManager from './components/RuleManager.vue'
import api from './components/api.js'

const accounts = ref([])
const selected = ref('transactions')
const hasTransactions = ref(false)

async function loadAccounts() {
  accounts.value = await api.getAccounts()
}

async function checkTransactions() {
  try {
    const transactions = await api.listTransactions()
    hasTransactions.value = transactions.length > 0
    // If no transactions exist, default to import tab
    if (!hasTransactions.value && selected.value === 'transactions') {
      selected.value = 'import'
    }
  } catch (error) {
    console.error('Error checking transactions:', error)
    hasTransactions.value = false
  }
}

async function handleImportComplete() {
  await checkTransactions()
}

onMounted(async () => {
  await loadAccounts()
  await checkTransactions()
})
</script>

<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-app-bar-title>Can I Afford That</v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container max-width="1200" class="pa-4">
        <v-tabs v-model="selected" class="mb-4">
          <v-tab v-if="hasTransactions" value="transactions">
            <v-icon left>mdi-format-list-bulleted</v-icon>
            Transactions
          </v-tab>
          <v-tab value="import">
            <v-icon left>mdi-upload</v-icon>
            Import
          </v-tab>
          <v-tab value="new-rule">
            <v-icon left>mdi-plus-circle</v-icon>
            New Category Rule
          </v-tab>
          <v-tab value="rules">
            <v-icon left>mdi-cog</v-icon>
            Manage Rules
          </v-tab>
          <v-tab value="charts">
            <v-icon left>mdi-chart-pie</v-icon>
            Charts
          </v-tab>
          <v-tab value="versions">
            <v-icon left>mdi-database</v-icon>
            Database Versions
          </v-tab>
        </v-tabs>

        <v-window v-model="selected">
          <v-window-item value="import">
            <v-card v-if="!hasTransactions" class="mb-4" color="primary" dark>
              <v-card-text class="text-center pa-8">
                <v-icon size="64" class="mb-4">mdi-wallet</v-icon>
                <h2 class="text-h4 mb-2">Welcome to CIAT!</h2>
                <p class="text-h6">Get started by importing transactions to begin tracking your finances.</p>
              </v-card-text>
            </v-card>
            <ImportWizard :accounts="accounts" @refresh-accounts="loadAccounts" @import-complete="handleImportComplete" />
          </v-window-item>

          <v-window-item value="transactions">
            <TransactionsTable />
          </v-window-item>

          <v-window-item value="new-rule">
            <NewCategoryWizard @close="selected=hasTransactions ? 'transactions' : 'import'" />
          </v-window-item>

          <v-window-item value="rules">
            <RuleManager @create-new="selected='new-rule'" />
          </v-window-item>

          <v-window-item value="versions">
            <DatabaseVersions />
          </v-window-item>

          <v-window-item value="charts">
            <v-row>
              <v-col cols="12" md="6">
                <PieChart />
              </v-col>
              <v-col cols="12" md="6">
                <LineChart />
              </v-col>
            </v-row>
          </v-window-item>
        </v-window>
      </v-container>
    </v-main>
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

