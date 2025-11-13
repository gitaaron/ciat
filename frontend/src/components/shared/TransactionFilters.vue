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
  emits: ['update:searchQuery', 'update:selectedCategory', 'update:selectedAccount', 'update:startDate', 'update:endDate', 'update:selectedLabel', 'clear-filters'],
  setup(props, { emit }) {
    const buttonColSize = computed(() => {
      let visibleFilters = 0
      if (props.showSearchFilter) visibleFilters++
      if (props.showCategoryFilter) visibleFilters++
      if (props.showAccountFilter) visibleFilters++
      if (props.showDateFilters) visibleFilters += 1 // date filters take 1 column (4/12)
      if (props.showLabelFilter) visibleFilters++
      
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
      emit('clear-filters')
    }

    return {
      buttonColSize,
      clearFilters
    }
  }
}
</script>
