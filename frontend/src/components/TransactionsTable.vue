
<script setup>
import { ref, watchEffect } from 'vue'
import api from './api.js'

const q = ref('')
const category = ref('')
const label = ref('')
const start = ref('')
const end = ref('')
const sort = ref('date')
const order = ref('DESC')
const rows = ref([])

async function load() {
  rows.value = await api.listTransactions({ q: q.value, category: category.value, label: label.value, start: start.value, end: end.value, sort: sort.value, order: order.value })
}
watchEffect(load)

function getLabels(item) {
  if (!item.labels) return []
  try {
    const labels = JSON.parse(item.labels)
    return Array.isArray(labels) ? labels : []
  } catch (e) {
    return []
  }
}

async function overrideCategory(row) {
  const pattern = row.name   // default pattern suggestion: exact merchant name
  await api.setCategory(row.id, { category: row.category, pattern, match_type: 'exact', explain: 'User override from table' })
  await load()
}
</script>

<template>
  <v-card>
    <v-card-title class="text-h5">
      <v-icon left>mdi-format-list-bulleted</v-icon>
      Transactions
    </v-card-title>

    <v-card-text>
      <!-- Filters -->
      <v-row class="mb-4">
        <v-col cols="12" md="3">
          <v-text-field
            v-model="q"
            label="Search name/amount/note"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-magnify"
            clearable
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-text-field
            v-model="start"
            label="Start Date"
            placeholder="YYYY-MM-DD"
            variant="outlined"
            density="compact"
            type="date"
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-text-field
            v-model="end"
            label="End Date"
            placeholder="YYYY-MM-DD"
            variant="outlined"
            density="compact"
            type="date"
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-select
            v-model="category"
            :items="[
              { title: 'All categories', value: '' },
              { title: 'Guilt Free', value: 'guilt_free' },
              { title: 'Short Term Savings', value: 'short_term_savings' },
              { title: 'Fixed Costs', value: 'fixed_costs' },
              { title: 'Investments', value: 'investments' }
            ]"
            item-title="title"
            item-value="value"
            label="Category"
            variant="outlined"
            density="compact"
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-text-field
            v-model="label"
            label="Label"
            variant="outlined"
            density="compact"
            placeholder="Filter by label"
            clearable
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-select
            v-model="sort"
            :items="[
              { title: 'Date', value: 'date' },
              { title: 'Amount', value: 'amount' },
              { title: 'Name', value: 'name' }
            ]"
            item-title="title"
            item-value="value"
            label="Sort by"
            variant="outlined"
            density="compact"
          />
        </v-col>
        <v-col cols="12" md="1">
          <v-select
            v-model="order"
            :items="[
              { title: 'DESC', value: 'DESC' },
              { title: 'ASC', value: 'ASC' }
            ]"
            item-title="title"
            item-value="value"
            label="Order"
            variant="outlined"
            density="compact"
          />
        </v-col>
      </v-row>

      <!-- Data Table -->
      <v-data-table
        :headers="[
          { title: 'Date', key: 'date', sortable: true },
          { title: 'Account', key: 'account_name', sortable: true },
          { title: 'Name', key: 'name', sortable: true },
          { title: 'Description', key: 'description', sortable: true },
          { title: 'Amount', key: 'amount', sortable: true },
          { title: 'Type', key: 'inflow', sortable: true },
          { title: 'Category', key: 'category', sortable: false },
          { title: 'Labels', key: 'labels', sortable: false },
          { title: 'Explain', key: 'category_explain', sortable: false },
          { title: 'Actions', key: 'actions', sortable: false }
        ]"
        :items="rows"
        class="elevation-1"
      >
        <template v-slot:item.amount="{ item }">
          <span class="font-weight-medium">
            ${{ item.amount !== null && item.amount !== undefined && !isNaN(item.amount) ? Number(item.amount).toFixed(2) : '0.00' }}
          </span>
        </template>
        
        <template v-slot:item.inflow="{ item }">
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
              { title: 'Guilt Free', value: 'guilt_free' },
              { title: 'Short Term Savings', value: 'short_term_savings' },
              { title: 'Fixed Costs', value: 'fixed_costs' },
              { title: 'Investments', value: 'investments' }
            ]"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            hide-details
            style="min-width: 150px;"
          />
        </template>
        
        <template v-slot:item.labels="{ item }">
          <div v-if="getLabels(item).length > 0" class="d-flex flex-wrap ga-1">
            <v-chip
              v-for="label in getLabels(item)"
              :key="label"
              size="small"
              color="primary"
              variant="tonal"
            >
              {{ label }}
            </v-chip>
          </div>
          <span v-else class="text-caption text-grey">No labels</span>
        </template>
        
        <template v-slot:item.category_explain="{ item }">
          <span class="text-caption">{{ item.category_explain }}</span>
        </template>
        
        <template v-slot:item.actions="{ item }">
          <v-btn
            @click="overrideCategory(item)"
            color="primary"
            variant="outlined"
            size="small"
          >
            <v-icon left>mdi-content-save</v-icon>
            Save
          </v-btn>
        </template>
      </v-data-table>
    </v-card-text>
  </v-card>
</template>
