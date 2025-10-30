<template>
  <div class="transaction-review">
    <div class="header">
      <h3>Transaction Review</h3>
      <p class="subtitle">
        Review all transactions that will be imported with their assigned categories.
      </p>
    </div>

    <!-- Search and Filters -->
    <TransactionFilters
      v-model:search-query="searchQuery"
      v-model:selected-category="selectedCategory"
      v-model:selected-account="selectedAccount"
      :category-options="categoryOptions"
      :account-options="accountOptions"
      :show-category-filter="false"
      :show-account-filter="false"
      :show-date-filters="false"
      :show-label-filter="false"
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

    <!-- Transaction Table (Grouped View) -->
    <TransactionTable
      v-if="hasTransactions"
      :items="[]"
      :headers="transactionHeaders"
      :grouped="true"
      :category-groups="categoryGroups"
      :uncategorized-transactions="uncategorizedTransactions"
      :uncategorized-total="uncategorizedTotal"
      :uncategorized-expanded="uncategorizedExpanded"
      :expanded-categories="expandedCategories"
      :show-uncategorized-warning="true"
      @toggle-category="toggleCategory"
    />

    <!-- Action Buttons -->
    <v-card class="mt-4" variant="outlined">
      <v-card-text>
        <div class="d-flex align-center justify-space-between">
          <div class="actions-info">
            <p class="mb-0">
              <strong>{{ totalTransactions }}</strong> transactions ready to import.
              <span v-if="uncategorizedCount > 0" class="text-warning">
                <strong>{{ uncategorizedCount }}</strong> transactions will be imported without categories.
              </span>
            </p>
          </div>
          <div class="d-flex ga-2">
            <v-btn
              color="secondary"
              variant="outlined"
              @click="goBackToRules"
              :disabled="processing"
            >
              <v-icon left>mdi-arrow-left</v-icon>
              Back to Rules
            </v-btn>
            <v-btn
              color="primary"
              size="large"
              @click="importTransactions"
              :loading="processing"
              :disabled="processing || totalTransactions === 0"
            >
              <span v-if="processing" class="loading-spinner">⏳</span>
              <v-icon v-else left>mdi-content-save</v-icon>
              {{ processing ? 'Saving...' : 'Save' }}
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script>
import TransactionFilters from '../shared/TransactionFilters.vue'
import TransactionStats from '../shared/TransactionStats.vue'
import TransactionTable from '../shared/TransactionTable.vue'
import TransactionReviewJS from './TransactionReview.js'

export default {
  ...TransactionReviewJS,
  components: {
    TransactionFilters,
    TransactionStats,
    TransactionTable
  }
}
</script>
<style scoped src="./TransactionReview.css"></style>
