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
      
      <template v-slot:item.name="{ item }">
        <div class="d-flex align-center ga-2">
          <v-menu
            v-model="menuOpen[item.id]"
            location="bottom start"
            :close-on-content-click="false"
          >
            <template v-slot:activator="{ props }">
              <span 
                class="transaction-name-clickable"
                v-bind="props"
                @click="onTransactionNameClick(item, $event)"
              >
                {{ item.name }}
              </span>
            </template>
            <v-list>
              <v-list-item
                @click="handleManualOverride(item)"
              >
                <v-list-item-title>
                  <v-icon left size="small">mdi-lock</v-icon>
                  Manually Override Category
                  <v-chip v-if="item.has_manual_override === true" size="x-small" class="ml-2">Already Overridden</v-chip>
                </v-list-item-title>
              </v-list-item>
              <v-list-item
                @click="handleOpenRule(item)"
              >
                <v-list-item-title>
                  <v-icon left size="small">mdi-open-in-new</v-icon>
                  Open Corresponding Rule
                </v-list-item-title>
              </v-list-item>
              <v-list-item
                @click="handleCreateRule(item)"
              >
                <v-list-item-title>
                  <v-icon left size="small">mdi-plus-circle</v-icon>
                  Create New Rule
                </v-list-item-title>
              </v-list-item>
              <v-list-item
                v-if="item.hash"
                @click="handleCopyHash(item)"
              >
                <v-list-item-title>
                  <v-icon left size="small">mdi-content-copy</v-icon>
                  Copy Hash: {{ truncateHash(item.hash) }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
          <v-chip
            v-if="getLastFourDigits(item.external_id)"
            size="small"
            color="primary"
            variant="tonal"
            class="cc-number-chip"
          >
            <v-icon size="small" class="mr-1">mdi-credit-card</v-icon>
            ****{{ getLastFourDigits(item.external_id) }}
          </v-chip>
        </div>
      </template>
      
      <template v-slot:item.amount="{ item }">
        <v-tooltip location="top">
          <template v-slot:activator="{ props }">
            <span 
              v-bind="props"
              class="font-weight-medium transaction-amount"
              :class="isInflow(item) ? 'amount-income' : 'amount-expense'"
            >
              {{ isInflow(item) ? '+' : '' }}${{ Math.abs(item.amount || 0).toFixed(2) }}
            </span>
          </template>
          <span>{{ isInflow(item) ? 'Income' : 'Expense' }}</span>
        </v-tooltip>
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
            <v-tooltip v-if="item.has_manual_override === true" location="top">
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
                  
                  <template v-slot:item.name="{ item }">
                    <div class="d-flex align-center ga-2">
                      <v-menu
                        v-model="menuOpen[item.id]"
                        location="bottom start"
                        :close-on-content-click="false"
                      >
                        <template v-slot:activator="{ props }">
                          <span 
                            class="transaction-name-clickable"
                            v-bind="props"
                            @click="onTransactionNameClick(item, $event)"
                          >
                            {{ item.name }}
                          </span>
                        </template>
                        <v-list>
                          <v-list-item
                            @click="handleManualOverride(item)"
                          >
                            <v-list-item-title>
                              <v-icon left size="small">mdi-lock</v-icon>
                              Manually Override Category
                            </v-list-item-title>
                          </v-list-item>
                          <v-list-item
                            @click="handleOpenRule(item)"
                          >
                            <v-list-item-title>
                              <v-icon left size="small">mdi-open-in-new</v-icon>
                              Open Corresponding Rule
                            </v-list-item-title>
                          </v-list-item>
                          <v-list-item
                            @click="handleCreateRule(item)"
                          >
                            <v-list-item-title>
                              <v-icon left size="small">mdi-plus-circle</v-icon>
                              Create New Rule
                            </v-list-item-title>
                          </v-list-item>
                          <v-list-item
                            v-if="item.hash"
                            @click="handleCopyHash(item)"
                          >
                            <v-list-item-title>
                              <v-icon left size="small">mdi-content-copy</v-icon>
                              Copy Hash: {{ truncateHash(item.hash) }}
                            </v-list-item-title>
                          </v-list-item>
                        </v-list>
                      </v-menu>
                      <v-chip
                        v-if="getLastFourDigits(item.external_id)"
                        size="small"
                        color="primary"
                        variant="tonal"
                        class="cc-number-chip"
                      >
                        <v-icon size="small" class="mr-1">mdi-credit-card</v-icon>
                        ****{{ getLastFourDigits(item.external_id) }}
                      </v-chip>
                    </div>
                  </template>
                  
                  <template v-slot:item.amount="{ item }">
                    <v-tooltip location="top">
                      <template v-slot:activator="{ props }">
                        <span 
                          v-bind="props"
                          class="font-weight-medium transaction-amount"
                          :class="(item.inflow === 1 || item.inflow === true) ? 'amount-income' : 'amount-expense'"
                        >
                          {{ (item.inflow === 1 || item.inflow === true) ? '+' : '' }}${{ Math.abs(item.amount || 0).toFixed(2) }}
                        </span>
                      </template>
                      <span>{{ (item.inflow === 1 || item.inflow === true) ? 'Income' : 'Expense' }}</span>
                    </v-tooltip>
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
                        <v-tooltip v-if="item.has_manual_override === true" location="top">
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
                  
                  <template v-slot:item.name="{ item }">
                    <div class="d-flex align-center ga-2">
                      <v-menu
                        v-model="menuOpen[item.id]"
                        location="bottom start"
                        :close-on-content-click="false"
                      >
                        <template v-slot:activator="{ props }">
                          <span 
                            class="transaction-name-clickable"
                            v-bind="props"
                            @click="onTransactionNameClick(item, $event)"
                          >
                            {{ item.name }}
                          </span>
                        </template>
                        <v-list>
                          <v-list-item
                            @click="handleManualOverride(item)"
                          >
                            <v-list-item-title>
                              <v-icon left size="small">mdi-lock</v-icon>
                              Manually Override Category
                            </v-list-item-title>
                          </v-list-item>
                          <v-list-item
                            @click="handleOpenRule(item)"
                          >
                            <v-list-item-title>
                              <v-icon left size="small">mdi-open-in-new</v-icon>
                              Open Corresponding Rule
                            </v-list-item-title>
                          </v-list-item>
                          <v-list-item
                            @click="handleCreateRule(item)"
                          >
                            <v-list-item-title>
                              <v-icon left size="small">mdi-plus-circle</v-icon>
                              Create New Rule
                            </v-list-item-title>
                          </v-list-item>
                          <v-list-item
                            v-if="item.hash"
                            @click="handleCopyHash(item)"
                          >
                            <v-list-item-title>
                              <v-icon left size="small">mdi-content-copy</v-icon>
                              Copy Hash: {{ truncateHash(item.hash) }}
                            </v-list-item-title>
                          </v-list-item>
                        </v-list>
                      </v-menu>
                      <v-chip
                        v-if="getLastFourDigits(item.external_id)"
                        size="small"
                        color="primary"
                        variant="tonal"
                        class="cc-number-chip"
                      >
                        <v-icon size="small" class="mr-1">mdi-credit-card</v-icon>
                        ****{{ getLastFourDigits(item.external_id) }}
                      </v-chip>
                    </div>
                  </template>
                  
                  <template v-slot:item.amount="{ item }">
                    <v-tooltip location="top">
                      <template v-slot:activator="{ props }">
                        <span 
                          v-bind="props"
                          class="font-weight-medium transaction-amount"
                          :class="(item.inflow === 1 || item.inflow === true) ? 'amount-income' : 'amount-expense'"
                        >
                          {{ (item.inflow === 1 || item.inflow === true) ? '+' : '' }}${{ Math.abs(item.amount || 0).toFixed(2) }}
                        </span>
                      </template>
                      <span>{{ (item.inflow === 1 || item.inflow === true) ? 'Income' : 'Expense' }}</span>
                    </v-tooltip>
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
                        <v-tooltip v-if="item.has_manual_override === true" location="top">
                          <template v-slot:activator="{ props }">
                            <v-icon v-bind="props" color="primary" size="small">mdi-lock</v-icon>
                          </template>
                          <span>Category manually overridden - will not be recategorized by rules</span>
                        </v-tooltip>
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
import { ref } from 'vue'
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
  emits: ['toggle-category', 'save-item', 'row-click', 'category-change', 'transaction-name-click', 'manual-override', 'open-rule', 'create-rule'],
  setup(props, { emit }) {
    // Menu state - track which transaction's menu is open
    const menuOpen = ref({})
    // Helper function to check if transaction is inflow (handles both number and string)
    function isInflow(transaction) {
      if (!transaction || transaction.inflow === undefined || transaction.inflow === null) {
        return false
      }
      // Handle both number (0/1) and string ("0"/"1") cases
      return transaction.inflow === 1 || transaction.inflow === true || transaction.inflow === '1'
    }

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

    function onTransactionNameClick(item, event) {
      // Menu will be opened by v-menu activator
      // No need to prevent default - menu handles it
    }

    function handleManualOverride(item) {
      menuOpen.value[item.id] = false
      emit('manual-override', item)
    }

    function handleOpenRule(item) {
      menuOpen.value[item.id] = false
      emit('open-rule', item)
    }

    function handleCreateRule(item) {
      menuOpen.value[item.id] = false
      emit('create-rule', item)
    }

    function truncateHash(hash) {
      if (!hash) return ''
      // Show first 8 and last 4 characters for readability
      if (hash.length > 12) {
        return `${hash.slice(0, 8)}...${hash.slice(-4)}`
      }
      return hash
    }

    async function handleCopyHash(item) {
      if (!item.hash) return
      
      try {
        await navigator.clipboard.writeText(item.hash)
        menuOpen.value[item.id] = false
        // Optionally show a toast notification here if you have a toast system
      } catch (err) {
        console.error('Failed to copy hash to clipboard:', err)
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = item.hash
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          menuOpen.value[item.id] = false
        } catch (fallbackErr) {
          console.error('Fallback copy failed:', fallbackErr)
        }
        document.body.removeChild(textArea)
      }
    }

    function getLastFourDigits(ccNumber) {
      if (!ccNumber) return null
      const cleaned = String(ccNumber).replace(/\D/g, '') // Remove non-digits
      if (cleaned.length >= 4) {
        return cleaned.slice(-4) // Get last 4 digits
      }
      return null
    }

    return {
      getCategoryDisplayName: getCategoryName,
      getCategoryIcon,
      getCategoryColor,
      categorySelectOptions: CATEGORY_SELECT_OPTIONS,
      formatDate,
      getLabels,
      isInflow,
      toggleCategory,
      onSaveItem,
      onCategoryChange,
      onRowClick,
      onTransactionNameClick,
      getLastFourDigits,
      menuOpen,
      handleManualOverride,
      handleOpenRule,
      handleCreateRule,
      truncateHash,
      handleCopyHash
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

.transaction-name-clickable {
  cursor: pointer;
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
}

.transaction-name-clickable:hover {
  color: rgb(var(--v-theme-primary-darken-1));
}

.transaction-amount {
  cursor: help;
}

.amount-income {
  color: #4caf50;
}

.amount-expense {
  color: #000000;
}

.cc-number-chip {
  min-width: 110px !important;
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
