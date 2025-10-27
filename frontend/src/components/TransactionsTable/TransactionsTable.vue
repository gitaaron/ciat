<template>
  <v-card>
    <v-card-title class="text-h5">
      <v-icon left>mdi-format-list-bulleted</v-icon>
      Transactions
    </v-card-title>

    <v-card-text>
      <!-- Filters -->
      <TransactionFilters
        v-model:search-query="q"
        v-model:selected-category="category"
        v-model:selected-account="account"
        v-model:start-date="start"
        v-model:end-date="end"
        v-model:selected-label="label"
        :category-options="categoryFilterOptions"
        :account-options="accountOptions"
        :show-category-filter="true"
        :show-account-filter="true"
        :show-date-filters="true"
        :show-label-filter="true"
        search-placeholder="Search name/amount/note"
        @clear-filters="clearFilters"
      />

      <!-- Summary Stats -->
      <TransactionStats
        :total-transactions="totalTransactions"
        :categorized-count="categorizedCount"
        :uncategorized-count="uncategorizedCount"
        :total-amount="totalAmount"
        :show-categorized="true"
        :show-uncategorized="true"
        :show-total-amount="true"
        :show-uncategorized-amount="false"
      />

      <!-- Data Table -->
      <TransactionTable
        :items="rows"
        :headers="tableHeaders"
        :grouped="false"
        :loading="loading"
        :show-category-edit="true"
        @save-item="overrideCategory"
      />
    </v-card-text>
  </v-card>
</template>

<script>
import TransactionsTableJS from './TransactionsTable.js'

export default {
  ...TransactionsTableJS
}
</script>
