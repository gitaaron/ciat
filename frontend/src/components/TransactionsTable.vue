
<script setup>
import { ref, watchEffect } from 'vue'
import api from './api.js'

const q = ref('')
const category = ref('')
const start = ref('')
const end = ref('')
const sort = ref('date')
const order = ref('DESC')
const rows = ref([])

async function load() {
  rows.value = await api.listTransactions({ q: q.value, category: category.value, start: start.value, end: end.value, sort: sort.value, order: order.value })
}
watchEffect(load)

async function overrideCategory(row) {
  const pattern = row.name   // default pattern suggestion: exact merchant name
  await api.setCategory(row.id, { category: row.category, pattern, match_type: 'exact', explain: 'User override from table' })
  await load()
}
</script>

<template>
  <div>
    <h2>Transactions</h2>
    <div style="display:flex; gap:8px; flex-wrap: wrap; margin-bottom:8px;">
      <input v-model="q" placeholder="Search name/amount/note" />
      <input v-model="start" placeholder="Start (YYYY-MM-DD)" />
      <input v-model="end" placeholder="End (YYYY-MM-DD)" />
      <select v-model="category">
        <option value="">All categories</option>
        <option value="guilt_free">guilt_free</option>
        <option value="short_term_savings">short_term_savings</option>
        <option value="fixed_costs">fixed_costs</option>
        <option value="investments">investments</option>
      </select>
      <select v-model="sort">
        <option value="date">date</option>
        <option value="amount">amount</option>
        <option value="name">name</option>
      </select>
      <select v-model="order">
        <option value="DESC">DESC</option>
        <option value="ASC">ASC</option>
      </select>
    </div>

    <table border="1" cellpadding="6">
      <thead>
        <tr>
          <th>Date</th><th>Account</th><th>Name</th><th>Description</th><th>Amount</th><th>Inflow</th><th>Category</th><th>Explain</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id">
          <td>{{ r.date }}</td>
          <td>{{ r.account_name }}</td>
          <td>{{ r.name }}</td>
          <td>{{ r.description }}</td>
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
          <td>{{ r.category_explain }}</td>
          <td><button @click="overrideCategory(r)">Save</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
