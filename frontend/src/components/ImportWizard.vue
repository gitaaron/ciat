
<script setup>
import { ref } from 'vue'
import api from './api.js'

const props = defineProps({ accounts: Array })
const emit = defineEmits(['refresh-accounts'])

const newAccount = ref('')
const selectedAccount = ref(null)
const file = ref(null)
const preview = ref([])
const step = ref(1)

async function addAccount() {
  if (!newAccount.value) return
  await api.createAccount(newAccount.value)
  newAccount.value = ''
  await emit('refresh-accounts')
}

async function doPreview() {
  if (!selectedAccount.value || !file.value) return
  const res = await api.importCSV(selectedAccount.value, file.value)
  preview.value = res.preview
  step.value = 2
}

async function commitImport() {
  await api.commitImport(preview.value.filter(x => !x.ignore))
  preview.value = []
  step.value = 1
  alert('Import complete')
}
</script>

<template>
  <div>
    <h2>Import</h2>
    <div>
      <label>Choose Account:</label>
      <select v-model="selectedAccount">
        <option :value="null">-- Select --</option>
        <option v-for="a in props.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
      <input v-model="newAccount" placeholder="New account name" />
      <button @click="addAccount">Add Account</button>
    </div>

    <div style="margin-top:12px;">
      <input type="file" @change="e=>file.value=e.target.files[0]" accept=".csv,text/csv" />
      <button @click="doPreview">Preview</button>
    </div>

    <div v-if="step===2" style="margin-top:16px;">
      <h3>Review</h3>
      <table border="1" cellpadding="6">
        <thead>
          <tr>
            <th>Date</th><th>Name</th><th>Amount</th><th>Inflow</th><th>Category</th><th>Source</th><th>Ignore</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r,i) in preview" :key="i">
            <td>{{ r.date }}</td>
            <td>{{ r.name }}</td>
            <td>{{ Number(r.amount).toFixed(2) }}</td>
            <td>{{ r.inflow ? 'Income' : 'Expense' }}</td>
            <td>
              <select v-model="r.category">
                <option value="">(none)</option>
                <option value="guilt_free">guilt_free</option>
                <option value="short_term_savings">short_term_savings</option>
                <option value="fixed_costs">fixed_costs</option>
                <option value="investments">investments</option>
              </select>
            </td>
            <td>{{ r.category_source }}</td>
            <td><input type="checkbox" v-model="r.ignore" /></td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top:12px;">
        <button @click="commitImport">Import</button>
      </div>
    </div>
  </div>
</template>
