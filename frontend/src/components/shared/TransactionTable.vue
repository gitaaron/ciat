<template>
  <div>
    <!-- Single Table View -->
    <v-data-table
      v-if="!grouped"
      :headers="headers"
      :items="items"
      :items-per-page="itemsPerPage"
      :loading="loading"
      class="elevation-1"
      @click:row="onRowClick"
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
        <div class="d-flex align-center ga-2">
          <v-select
            v-if="showCategoryEdit"
            v-model="item.category"
            :items="categorySelectOptions"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            hide-details
            style="min-width: 150px;"
            @update:model-value="onCategoryChange(item)"
          />
          <div v-else class="d-flex align-center ga-1">
            <v-chip
              v-if="item.category"
              :color="getCategoryColor(item.category)"
              size="small"
              variant="tonal"
            >
              {{ getCategoryDisplayName(item.category) }}
            </v-chip>
            <v-chip
              v-else
              color="grey"
              size="small"
              variant="outlined"
            >
              No Category
            </v-chip>
            <v-tooltip v-if="item.manual_override === 1 || item.manual_override === true" location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" color="primary" size="small">mdi-lock</v-icon>
              </template>
              <span>Category manually overridden - will not be recategorized by rules</span>
            </v-tooltip>
          </div>
        </div>
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
      
    </v-data-table>

    <!-- Grouped Table View -->
    <div v-else-if="grouped && (categoryGroups.length > 0 || uncategorizedTransactions.length > 0)" class="category-groups">
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
                  :headers="headers"
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
                    <div class="d-flex align-center ga-2">
                      <v-select
                        v-if="showCategoryEdit"
                        v-model="item.category"
                        :items="categorySelectOptions"
                        item-title="title"
                        item-value="value"
                        variant="outlined"
                        density="compact"
                        hide-details
                        style="min-width: 150px;"
                        @update:model-value="onCategoryChange(item)"
                      />
                      <div v-else class="d-flex align-center ga-1">
                        <v-chip
                          v-if="item.category"
                          :color="getCategoryColor(item.category)"
                          size="small"
                          variant="tonal"
                        >
                          {{ getCategoryDisplayName(item.category) }}
                        </v-chip>
                        <v-chip
                          v-else
                          color="grey"
                          size="small"
                          variant="outlined"
                        >
                          No Category
                        </v-chip>
                        <v-tooltip v-if="item.manual_override === 1 || item.manual_override === true" location="top">
                          <template v-slot:activator="{ props }">
                            <v-icon v-bind="props" color="primary" size="small">mdi-lock</v-icon>
                          </template>
                          <span>Category manually overridden - will not be recategorized by rules</span>
                        </v-tooltip>
                      </div>
                    </div>
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
                  v-if="showUncategorizedWarning"
                  type="warning"
                  variant="tonal"
                  class="mb-4"
                >
                  These transactions don't have categories assigned. They will be imported without categories and can be categorized later.
                </v-alert>
                
                <v-data-table
                  :headers="headers"
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
                    <div class="d-flex align-center ga-2">
                      <v-select
                        v-if="showCategoryEdit"
                        v-model="item.category"
                        :items="categorySelectOptions"
                        item-title="title"
                        item-value="value"
                        variant="outlined"
                        density="compact"
                        hide-details
                        style="min-width: 150px;"
                        @update:model-value="onCategoryChange(item)"
                      />
                      <div v-else class="d-flex align-center ga-1">
                        <v-chip
                          color="grey"
                          size="small"
                          variant="outlined"
                        >
                          No Category
                        </v-chip>
                      </div>
                    </div>
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
  </div>
</template>

<script>
import { getCategoryName, getCategoryIcon, getCategoryColor, CATEGORY_SELECT_OPTIONS } from '../../config/categories.js'

export default {
  name: 'TransactionTable',
  props: {
    items: {
      type: Array,
      default: () => []
    },
    headers: {
      type: Array,
      required: true
    },
    grouped: {
      type: Boolean,
      default: false
    },
    categoryGroups: {
      type: Array,
      default: () => []
    },
    uncategorizedTransactions: {
      type: Array,
      default: () => []
    },
    uncategorizedTotal: {
      type: Number,
      default: 0
    },
    uncategorizedExpanded: {
      type: Boolean,
      default: false
    },
    expandedCategories: {
      type: Set,
      default: () => new Set()
    },
    loading: {
      type: Boolean,
      default: false
    },
    itemsPerPage: {
      type: Number,
      default: 10
    },
    showUncategorizedWarning: {
      type: Boolean,
      default: true
    },
    showCategoryEdit: {
      type: Boolean,
      default: false
    }
  },
  emits: ['toggle-category', 'save-item', 'row-click', 'category-change'],
  setup(props, { emit }) {
    function formatDate(dateString) {
      if (!dateString) return 'Unknown'
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Unknown'
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }

    function getLabels(transaction) {
      if (!transaction.labels) return []
      if (typeof transaction.labels === 'string') {
        try {
          return JSON.parse(transaction.labels)
        } catch {
          return transaction.labels.split(',').map(l => l.trim()).filter(l => l)
        }
      }
      return Array.isArray(transaction.labels) ? transaction.labels : []
    }

    function toggleCategory(categoryName) {
      emit('toggle-category', categoryName)
    }

    function onSaveItem(item) {
      emit('save-item', item)
    }

    function onCategoryChange(item) {
      emit('category-change', item)
      // Also emit save-item for backward compatibility
      emit('save-item', item)
    }

    function onRowClick(event, item) {
      emit('row-click', item)
    }

    return {
      getCategoryDisplayName: getCategoryName,
      getCategoryIcon,
      getCategoryColor,
      categorySelectOptions: CATEGORY_SELECT_OPTIONS,
      formatDate,
      getLabels,
      toggleCategory,
      onSaveItem,
      onCategoryChange,
      onRowClick
    }
  }
}
</script>

<style scoped>
.category-groups {
  margin-top: 1rem;
}

.category-group {
  margin-bottom: 1rem;
}

.category-header {
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  padding: 1rem;
  display: flex;
  align-items: center;
  transition: background-color 0.2s;
}

.category-header:hover {
  background-color: #eeeeee;
}

.category-header.uncategorized {
  background-color: #fff3e0;
  border-bottom-color: #ffcc02;
}

.category-stats {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: #666;
}

.no-transactions {
  margin-top: 2rem;
}
</style>
