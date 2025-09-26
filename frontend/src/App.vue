
<script setup>
import { ref, onMounted } from 'vue'
import ImportWizard from './components/ImportWizard.vue'
import TransactionsTable from './components/TransactionsTable.vue'
import PieChart from './components/PieChart.vue'
import LineChart from './components/LineChart.vue'
import api from './components/api.js'

const accounts = ref([])
const selected = ref('transactions')

async function loadAccounts() {
  accounts.value = await api.getAccounts()
}
onMounted(loadAccounts)
</script>

<template>
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 16px; max-width: 1100px; margin: 0 auto;">
    <h1>CIAT</h1>
    <nav style="display:flex; gap:8px; margin: 8px 0 16px;">
      <button @click="selected='transactions'">Transactions</button>
      <button @click="selected='import'">Import</button>
      <button @click="selected='charts'">Charts</button>
    </nav>

    <div v-if="selected==='import'">
      <ImportWizard :accounts="accounts" @refresh-accounts="loadAccounts" />
    </div>
    <div v-else-if="selected==='transactions'">
      <TransactionsTable />
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
</style>
