<template>
  <v-card v-if="showCard" class="mb-4" variant="outlined">
    <v-card-text>
      <v-row>
        <v-col v-if="showSearchFilter" cols="12" md="4">
          <v-text-field
            :model-value="searchQuery"
            @update:model-value="$emit('update:searchQuery', $event)"
            label="Search transactions"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-magnify"
            clearable
            :placeholder="searchPlaceholder"
          />
        </v-col>
        
        <v-col v-if="showCategoryFilter" cols="12" md="3">
          <v-select
            :model-value="selectedCategory"
            @update:model-value="$emit('update:selectedCategory', $event)"
            :items="categoryOptions"
            item-title="title"
            item-value="value"
            label="Filter by Category"
            variant="outlined"
            density="compact"
            clearable
          />
        </v-col>
        
        <v-col v-if="showAccountFilter" cols="12" md="3">
          <v-select
            :model-value="selectedAccount"
            @update:model-value="$emit('update:selectedAccount', $event)"
            :items="accountOptions"
            item-title="name"
            item-value="id"
            label="Filter by Account"
            variant="outlined"
            density="compact"
            clearable
          />
        </v-col>
        
        <v-col v-if="showDateFilters" cols="12" md="4">
          <v-row>
            <v-col cols="6">
              <v-text-field
                :model-value="startDate"
                @update:model-value="$emit('update:startDate', $event)"
                label="Start Date"
                placeholder="YYYY-MM-DD"
                variant="outlined"
                density="compact"
                type="date"
                prepend-inner-icon="mdi-calendar"
                hide-details
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                :model-value="endDate"
                @update:model-value="$emit('update:endDate', $event)"
                label="End Date"
                placeholder="YYYY-MM-DD"
                variant="outlined"
                density="compact"
                type="date"
                prepend-inner-icon="mdi-calendar"
                hide-details
              />
            </v-col>
          </v-row>
        </v-col>
        
        <v-col v-if="showLabelFilter" cols="12" md="2">
          <v-text-field
            :model-value="selectedLabel"
            @update:model-value="$emit('update:selectedLabel', $event)"
            label="Label"
            variant="outlined"
            density="compact"
            placeholder="Filter by label"
            clearable
          />
        </v-col>
        
        <v-col v-if="showHideNetZero" cols="12" md="auto">
          <v-tooltip location="top">
            <template v-slot:activator="{ props }">
              <v-switch
                v-bind="props"
                :model-value="hideNetZero"
                @update:model-value="$emit('update:hide-net-zero', $event)"
                label="Hide Net Zero"
                color="primary"
                density="compact"
                hide-details
                class="mt-2"
              />
            </template>
            <span>Hide pairs of transactions with equal amounts where one is inflow and the other is outflow</span>
          </v-tooltip>
        </v-col>
        
        <v-col v-if="showInflowFilter" cols="12" md="3">
          <v-radio-group
            :model-value="inflowFilter"
            @update:model-value="$emit('update:inflowFilter', $event)"
            inline
            density="compact"
            hide-details
          >
            <v-radio label="Both" value="both" />
            <v-radio label="Inflow Only" value="inflow" />
            <v-radio label="Outflow Only" value="outflow" />
          </v-radio-group>
        </v-col>
        
        <v-col v-if="showAmountFilter" cols="12" md="4">
          <v-row>
            <v-col cols="6">
              <v-text-field
                :model-value="minAmount"
                @update:model-value="$emit('update:minAmount', $event)"
                label="Min Amount"
                placeholder="0.00"
                variant="outlined"
                density="compact"
                type="number"
                prepend-inner-icon="mdi-currency-usd"
                hide-details
                clearable
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                :model-value="maxAmount"
                @update:model-value="$emit('update:maxAmount', $event)"
                label="Max Amount"
                placeholder="0.00"
                variant="outlined"
                density="compact"
                type="number"
                prepend-inner-icon="mdi-currency-usd"
                hide-details
                clearable
              />
            </v-col>
          </v-row>
        </v-col>
        
        <v-col cols="12" :md="buttonColSize">
          <v-btn
            @click="clearFilters"
            color="secondary"
            variant="outlined"
            block
          >
            <v-icon left>mdi-filter-off</v-icon>
            {{ clearButtonText }}
          </v-btn>
        </v-col>
        
        <v-col cols="12" :md="buttonColSize">
          <v-btn
            @click="handleCreateRule"
            color="primary"
            variant="elevated"
            block
            :disabled="!hasActiveFilters"
          >
            <v-icon left>mdi-filter-plus</v-icon>
            Create Rule
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
  <div v-else>
    <v-row>
      <v-col v-if="showSearchFilter" cols="12" md="4">
        <v-text-field
          :model-value="searchQuery"
          @update:model-value="$emit('update:searchQuery', $event)"
          label="Search transactions"
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-magnify"
          clearable
          :placeholder="searchPlaceholder"
        />
      </v-col>
      
      <v-col v-if="showCategoryFilter" cols="12" md="3">
        <v-select
          :model-value="selectedCategory"
          @update:model-value="$emit('update:selectedCategory', $event)"
          :items="categoryOptions"
          item-title="title"
          item-value="value"
          label="Filter by Category"
          variant="outlined"
          density="compact"
          clearable
        />
      </v-col>
      
      <v-col v-if="showAccountFilter" cols="12" md="3">
        <v-select
          :model-value="selectedAccount"
          @update:model-value="$emit('update:selectedAccount', $event)"
          :items="accountOptions"
          item-title="name"
          item-value="id"
          label="Filter by Account"
          variant="outlined"
          density="compact"
          clearable
        />
      </v-col>
      
      <v-col v-if="showDateFilters" cols="12" md="4">
        <v-row>
          <v-col cols="6">
            <v-text-field
              :model-value="startDate"
              @update:model-value="$emit('update:startDate', $event)"
              label="Start Date"
              placeholder="YYYY-MM-DD"
              variant="outlined"
              density="compact"
              type="date"
              prepend-inner-icon="mdi-calendar"
              hide-details
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              :model-value="endDate"
              @update:model-value="$emit('update:endDate', $event)"
              label="End Date"
              placeholder="YYYY-MM-DD"
              variant="outlined"
              density="compact"
              type="date"
              prepend-inner-icon="mdi-calendar"
              hide-details
            />
          </v-col>
        </v-row>
      </v-col>
      
      <v-col v-if="showLabelFilter" cols="12" md="2">
        <v-text-field
          :model-value="selectedLabel"
          @update:model-value="$emit('update:selectedLabel', $event)"
          label="Label"
          variant="outlined"
          density="compact"
          placeholder="Filter by label"
          clearable
        />
      </v-col>
      
      <v-col v-if="showHideNetZero" cols="12" md="auto">
        <v-tooltip location="top">
          <template v-slot:activator="{ props }">
            <v-switch
              v-bind="props"
              :model-value="hideNetZero"
              @update:model-value="$emit('update:hide-net-zero', $event)"
              label="Hide Net Zero"
              color="primary"
              density="compact"
              hide-details
              class="mt-2"
            />
          </template>
          <span>Hide pairs of transactions with equal amounts where one is inflow and the other is outflow</span>
        </v-tooltip>
      </v-col>
      
      <v-col v-if="showInflowFilter" cols="12" md="3">
        <v-radio-group
          :model-value="inflowFilter"
          @update:model-value="$emit('update:inflowFilter', $event)"
          inline
          density="compact"
          hide-details
        >
          <v-radio label="Both" value="both" />
          <v-radio label="Inflow Only" value="inflow" />
          <v-radio label="Outflow Only" value="outflow" />
        </v-radio-group>
      </v-col>
      
      <v-col v-if="showAmountFilter" cols="12" md="4">
        <v-row>
          <v-col cols="6">
            <v-text-field
              :model-value="minAmount"
              @update:model-value="$emit('update:minAmount', $event)"
              label="Min Amount"
              placeholder="0.00"
              variant="outlined"
              density="compact"
              type="number"
              prepend-inner-icon="mdi-currency-usd"
              hide-details
              clearable
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              :model-value="maxAmount"
              @update:model-value="$emit('update:maxAmount', $event)"
              label="Max Amount"
              placeholder="0.00"
              variant="outlined"
              density="compact"
              type="number"
              prepend-inner-icon="mdi-currency-usd"
              hide-details
              clearable
            />
          </v-col>
        </v-row>
      </v-col>
      
      <v-col cols="12" :md="buttonColSize">
        <v-btn
          @click="clearFilters"
          color="secondary"
          variant="outlined"
          block
        >
          <v-icon left>mdi-filter-off</v-icon>
          {{ clearButtonText }}
        </v-btn>
      </v-col>
      
      <v-col cols="12" :md="buttonColSize">
        <v-btn
          @click="handleCreateRule"
          color="primary"
          variant="elevated"
          block
          :disabled="!hasActiveFilters"
        >
          <v-icon left>mdi-filter-plus</v-icon>
          Create Rule
        </v-btn>
      </v-col>
    </v-row>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'TransactionFilters',
  props: {
    searchQuery: {
      type: String,
      default: ''
    },
    selectedCategory: {
      type: String,
      default: ''
    },
    selectedAccount: {
      type: [String, Number],
      default: ''
    },
    startDate: {
      type: String,
      default: ''
    },
    endDate: {
      type: String,
      default: ''
    },
    selectedLabel: {
      type: String,
      default: ''
    },
    hideNetZero: {
      type: Boolean,
      default: false
    },
    showHideNetZero: {
      type: Boolean,
      default: false
    },
    inflowFilter: {
      type: String,
      default: 'both'
    },
    showInflowFilter: {
      type: Boolean,
      default: false
    },
    minAmount: {
      type: [String, Number],
      default: ''
    },
    maxAmount: {
      type: [String, Number],
      default: ''
    },
    showAmountFilter: {
      type: Boolean,
      default: false
    },
    categoryOptions: {
      type: Array,
      default: () => []
    },
    accountOptions: {
      type: Array,
      default: () => []
    },
    showCategoryFilter: {
      type: Boolean,
      default: true
    },
    showAccountFilter: {
      type: Boolean,
      default: false
    },
    showDateFilters: {
      type: Boolean,
      default: false
    },
    showLabelFilter: {
      type: Boolean,
      default: false
    },
    showSearchFilter: {
      type: Boolean,
      default: true
    },
    searchPlaceholder: {
      type: String,
      default: 'Search by name, amount, or description'
    },
    clearButtonText: {
      type: String,
      default: 'Clear'
    },
    showCard: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:searchQuery', 'update:selectedCategory', 'update:selectedAccount', 'update:startDate', 'update:endDate', 'update:selectedLabel', 'update:hide-net-zero', 'update:inflowFilter', 'update:minAmount', 'update:maxAmount', 'clear-filters', 'create-rule'],
  setup(props, { emit }) {
    const buttonColSize = computed(() => {
      let visibleFilters = 0
      if (props.showSearchFilter) visibleFilters++
      if (props.showCategoryFilter) visibleFilters++
      if (props.showAccountFilter) visibleFilters++
      if (props.showDateFilters) visibleFilters += 1 // date filters take 1 column (4/12)
      if (props.showLabelFilter) visibleFilters++
      if (props.showInflowFilter) visibleFilters++
      if (props.showAmountFilter) visibleFilters += 1 // amount filters take 1 column (4/12)
      
      // Calculate remaining space for button
      const remainingSpace = 12 - visibleFilters
      return Math.max(2, Math.min(remainingSpace, 3))
    })

    function clearFilters() {
      emit('update:searchQuery', '')
      emit('update:selectedCategory', '')
      emit('update:selectedAccount', '')
      emit('update:startDate', '')
      emit('update:endDate', '')
      emit('update:selectedLabel', '')
      emit('update:hide-net-zero', false)
      emit('update:inflowFilter', 'both')
      emit('update:minAmount', '')
      emit('update:maxAmount', '')
      emit('clear-filters')
    }

    // Check if there are any active filters (excluding hideNetZero)
    // For rule creation, we need at least a searchQuery or an inflowFilter (not 'both')
    // Other filters can be additional constraints, but we need at least one of these two
    const hasActiveFilters = computed(() => {
      const hasPatternOrInflow = !!(props.searchQuery || (props.inflowFilter && props.inflowFilter !== 'both'))
      // We need at least a pattern or inflow filter to create a rule
      // Other filters are additional constraints
      return hasPatternOrInflow
    })

    // Map filter fields to rule fields
    function handleCreateRule() {
      const ruleData = {}
      
      // Map searchQuery to pattern with match_type 'contains'
      if (props.searchQuery) {
        ruleData.pattern = props.searchQuery
        ruleData.match_type = 'contains'
      }
      
      // Map selectedCategory to category
      if (props.selectedCategory) {
        ruleData.category = props.selectedCategory
      }
      
      // Map selectedAccount to account_id
      if (props.selectedAccount) {
        ruleData.account_id = props.selectedAccount
      }
      
      // Map date range
      if (props.startDate) {
        ruleData.start_date = props.startDate
      }
      if (props.endDate) {
        ruleData.end_date = props.endDate
      }
      
      // Map selectedLabel to labels (array)
      if (props.selectedLabel) {
        ruleData.labels = [props.selectedLabel]
      }
      
      // Map inflowFilter
      if (props.inflowFilter && props.inflowFilter !== 'both') {
        if (props.inflowFilter === 'inflow') {
          // If only inflow, set match_type to 'inflow' (but only if no searchQuery)
          if (!props.searchQuery) {
            ruleData.match_type = 'inflow'
            // For inflow-only rules, we don't need a pattern
            ruleData.pattern = ''
          } else {
            // If we have both searchQuery and inflow, use the searchQuery pattern and add an inflow flag
            ruleData.inflow_only = true
          }
        } else if (props.inflowFilter === 'outflow') {
          ruleData.outflow_only = true
        }
      }
      
      // Map amount range
      if (props.minAmount) {
        ruleData.min_amount = parseFloat(props.minAmount)
      }
      if (props.maxAmount) {
        ruleData.max_amount = parseFloat(props.maxAmount)
      }
      
      // Require at least a pattern or an inflow filter to create a rule
      // (Other filters like category, account, dates, amounts are additional constraints)
      if (!ruleData.pattern && ruleData.match_type !== 'inflow' && !ruleData.inflow_only && !ruleData.outflow_only) {
        // If no pattern and no inflow/outflow filter, we can't create a meaningful rule
        // This shouldn't happen because hasActiveFilters should prevent the button from being enabled
        // But just in case, we'll emit with a flag to show an error
        emit('create-rule', { ...ruleData, _error: 'A rule must have at least a search pattern or an inflow/outflow filter' })
        return
      }
      
      // Emit the rule data
      emit('create-rule', ruleData)
    }

    return {
      buttonColSize,
      clearFilters,
      hasActiveFilters,
      handleCreateRule
    }
  }
}
</script>
