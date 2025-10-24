<template>
  <div class="transaction-review">
    <div class="header">
      <h3>Transaction Review</h3>
      <p class="subtitle">
        Review all transactions that will be imported with their assigned categories.
      </p>
    </div>

    <!-- Search and Filters -->
    <v-card class="mb-4" variant="outlined">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="searchQuery"
              label="Search transactions"
              variant="outlined"
              density="compact"
              prepend-inner-icon="mdi-magnify"
              clearable
              placeholder="Search by name, amount, or description"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="selectedCategory"
              :items="categoryOptions"
              item-title="title"
              item-value="value"
              label="Filter by Category"
              variant="outlined"
              density="compact"
              clearable
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="selectedAccount"
              :items="accountOptions"
              item-title="name"
              item-value="id"
              label="Filter by Account"
              variant="outlined"
              density="compact"
              clearable
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-btn
              @click="clearFilters"
              color="secondary"
              variant="outlined"
              block
            >
              <v-icon left>mdi-filter-off</v-icon>
              Clear
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Summary Stats -->
    <v-card class="mb-4" variant="outlined">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3">
            <div class="stat-item">
              <div class="stat-value">{{ totalTransactions }}</div>
              <div class="stat-label">Total Transactions</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="stat-item">
              <div class="stat-value">{{ categorizedCount }}</div>
              <div class="stat-label">Categorized</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="stat-item">
              <div class="stat-value">{{ uncategorizedCount }}</div>
              <div class="stat-label">Uncategorized</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="stat-item">
              <div class="stat-value">${{ totalAmount.toFixed(2) }}</div>
              <div class="stat-label">Total Amount</div>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Category Groups -->
    <div v-if="hasTransactions" class="category-groups">
      <!-- Categorized Transactions by Category -->
      <div
        v-for="category in categoryGroups"
        :key="category.name"
        class="category-group mb-4"
      >
        <v-card variant="outlined">
          <v-card-title
            class="category-header"
            @click="toggleCategory(category.name)"
            style="cursor: pointer;"
          >
            <v-icon left>{{ getCategoryIcon(category.name) }}</v-icon>
            {{ getCategoryDisplayName(category.name) }}
            <v-spacer />
            <div class="category-stats">
              <span class="mr-4">{{ category.transactions.length }} transactions</span>
              <span class="mr-2">${{ category.totalAmount.toFixed(2) }}</span>
              <v-icon>{{ category.expanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
            </div>
          </v-card-title>
          
          <v-expand-transition>
            <div v-show="category.expanded">
              <v-card-text class="pt-0">
                <v-data-table
                  :headers="transactionHeaders"
                  :items="category.transactions"
                  :items-per-page="10"
                  class="elevation-0"
                >
                  <template v-slot:item.date="{ item }">
                    {{ formatDate(item.date) }}
                  </template>
                  
                  <template v-slot:item.amount="{ item }">
                    <span class="font-weight-medium" :class="item.amount >= 0 ? 'text-success' : 'text-error'">
                      ${{ Math.abs(item.amount).toFixed(2) }}
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
                    <v-chip
                      :color="getCategoryColor(item.category)"
                      size="small"
                      variant="tonal"
                    >
                      {{ getCategoryDisplayName(item.category) }}
                    </v-chip>
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
                </v-data-table>
              </v-card-text>
            </div>
          </v-expand-transition>
        </v-card>
      </div>

      <!-- Uncategorized Transactions -->
      <div v-if="uncategorizedTransactions.length > 0" class="category-group mb-4">
        <v-card variant="outlined">
          <v-card-title
            class="category-header uncategorized"
            @click="toggleCategory('uncategorized')"
            style="cursor: pointer;"
          >
            <v-icon left color="warning">mdi-help-circle</v-icon>
            Uncategorized Transactions
            <v-spacer />
            <div class="category-stats">
              <span class="mr-4">{{ uncategorizedTransactions.length }} transactions</span>
              <span class="mr-2">${{ uncategorizedTotal.toFixed(2) }}</span>
              <v-icon>{{ uncategorizedExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
            </div>
          </v-card-title>
          
          <v-expand-transition>
            <div v-show="uncategorizedExpanded">
              <v-card-text class="pt-0">
                <v-alert
                  type="warning"
                  variant="tonal"
                  class="mb-4"
                >
                  These transactions don't have categories assigned. They will be imported without categories and can be categorized later.
                </v-alert>
                
                <v-data-table
                  :headers="transactionHeaders"
                  :items="uncategorizedTransactions"
                  :items-per-page="10"
                  class="elevation-0"
                >
                  <template v-slot:item.date="{ item }">
                    {{ formatDate(item.date) }}
                  </template>
                  
                  <template v-slot:item.amount="{ item }">
                    <span class="font-weight-medium" :class="item.amount >= 0 ? 'text-success' : 'text-error'">
                      ${{ Math.abs(item.amount).toFixed(2) }}
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
                    <v-chip
                      color="grey"
                      size="small"
                      variant="outlined"
                    >
                      No Category
                    </v-chip>
                  </template>
                  
                  <template v-slot:item.labels="{ item }">
                    <span class="text-caption text-grey">No labels</span>
                  </template>
                </v-data-table>
              </v-card-text>
            </div>
          </v-expand-transition>
        </v-card>
      </div>
    </div>

    <!-- No Transactions Message -->
    <div v-else class="no-transactions">
      <v-card variant="outlined">
        <v-card-text class="text-center pa-8">
          <v-icon size="64" color="grey" class="mb-4">mdi-file-document-outline</v-icon>
          <h3 class="text-h6 mb-2">No Transactions Found</h3>
          <p class="text-body-2">No transactions match your current filters.</p>
        </v-card-text>
      </v-card>
    </div>

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
              <v-icon left>mdi-content-save</v-icon>
              {{ processing ? 'Saving...' : 'Save' }}
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script src="./TransactionReview.js"></script>
<style scoped src="./TransactionReview.css"></style>
