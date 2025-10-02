
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
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 16px; max-width: 1100px; margin: 0 auto;">
    <h1>CIAT</h1>
    <nav style="display:flex; gap:8px; margin: 8px 0 16px;">
      <button v-if="hasTransactions" @click="selected='transactions'">Transactions</button>
      <button @click="selected='import'">Import</button>
      <button @click="selected='new-rule'">New Category Rule</button>
      <button @click="selected='rules'">Manage Rules</button>
      <button @click="selected='charts'">Charts</button>
      <button @click="selected='versions'">Database Versions</button>
    </nav>

    <div v-if="selected==='import'">
      <div v-if="!hasTransactions" class="get-started-message">
        <h2>Welcome to CIAT!</h2>
        <p>Get started by importing transactions to begin tracking your finances.</p>
      </div>
      <ImportWizard :accounts="accounts" @refresh-accounts="loadAccounts" @import-complete="handleImportComplete" />
    </div>
    <div v-else-if="selected==='transactions'">
      <TransactionsTable />
    </div>
    <div v-else-if="selected==='new-rule'">
      <NewCategoryWizard @close="selected=hasTransactions ? 'transactions' : 'import'" />
    </div>
    <div v-else-if="selected==='rules'">
      <RuleManager @create-new="selected='new-rule'" />
    </div>
    <div v-else-if="selected==='versions'">
      <DatabaseVersions />
    </div>
    <div v-else>
      <PieChart />
      <LineChart />
    </div>
  </div>
</template>

<style scoped>
button { padding: 6px 10px; border: 1px solid #ddd; background: #fafafa; cursor: pointer; }
button:hover { background: #f0f0f0; }

.get-started-message {
  text-align: center;
  padding: 40px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.get-started-message h2 {
  margin: 0 0 12px 0;
  font-size: 28px;
  font-weight: 600;
}

.get-started-message p {
  margin: 0;
  font-size: 16px;
  opacity: 0.9;
}
</style>
