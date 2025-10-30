<template>
  <v-card>
    <v-card-title class="text-h6">
      <v-icon left>mdi-target</v-icon>
      Category Targets
    </v-card-title>
    
    <v-card-text>
      <div v-if="loading" class="text-center pa-4">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading transactions...</p>
      </div>
      
      <div v-else-if="netIncome <= 0" class="text-center pa-4">
        <v-icon size="48" color="grey">mdi-information</v-icon>
        <p class="text-h6 mt-2">No income data available</p>
        <p class="text-body-2">Import transactions to set up category targets</p>
      </div>
      
      <div v-else>
        <!-- Net Income Display -->
        <v-alert type="info" variant="tonal" class="mb-4">
          <div class="d-flex align-center">
            <v-icon left>mdi-cash</v-icon>
            <span class="text-h6">Monthly Net Income: {{ formatCurrency(netIncome) }}</span>
          </div>
        </v-alert>
        
        <!-- Edit Controls -->
        <div class="d-flex justify-end mb-4">
          <v-btn
            v-if="!editing"
            @click="startEditing"
            color="primary"
            variant="outlined"
            prepend-icon="mdi-pencil"
          >
            Edit Targets
          </v-btn>
          <div v-else class="d-flex gap-2">
            <v-btn
              @click="cancelEditing"
              variant="outlined"
              color="grey"
            >
              Cancel
            </v-btn>
            <v-btn
              @click="saveChanges"
              :disabled="!targetsValid || saving"
              :loading="saving"
              color="primary"
              prepend-icon="mdi-check"
            >
              {{ saving ? 'Saving...' : 'Save' }}
            </v-btn>
          </div>
        </div>
        
        <!-- Targets Grid -->
        <v-row>
          <v-col
            v-for="category in CATEGORY_STEPS"
            :key="category"
            cols="12"
            md="6"
            lg="3"
          >
            <v-card
              :color="editing ? 'grey-lighten-5' : 'white'"
              variant="outlined"
              class="pa-3"
            >
              <div class="d-flex align-center mb-2">
                <v-icon
                  :color="CATEGORY_COLORS[category]"
                  class="mr-2"
                >
                  mdi-circle
                </v-icon>
                <span class="text-subtitle-1 font-weight-medium">
                  {{ CATEGORY_NAMES[category] }}
                </span>
              </div>
              
              <!-- Target Percentage Input -->
              <div v-if="editing" class="mb-3">
                <v-text-field
                  :model-value="tempTargets[category]"
                  @update:model-value="updateTarget(category, $event)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  suffix="%"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
              </div>
              
              <!-- Target Percentage Display -->
              <div v-else class="mb-3">
                <div class="text-h6 text-primary">
                  {{ formatPercentage(targets[category]) }}
                </div>
                <div class="text-caption text-grey">
                  Target
                </div>
              </div>
              
              <!-- Target Amount -->
              <div class="text-body-2 text-grey mb-2">
                Target: {{ formatCurrency(targetAmounts[category]) }}
              </div>
              
              <!-- Actual Amount -->
              <div class="text-body-2 text-grey mb-2">
                Actual: {{ formatCurrency(actualSpending[category]) }}
              </div>
              
              <!-- Historical Average -->
              <div class="text-body-2 text-grey mb-2">
                Avg: {{ formatCurrency(historicalAverages[category]) }}
              </div>
              
              <!-- Surplus/Deficit -->
              <div class="d-flex align-center">
                <v-icon
                  :color="categoryAnalysis[category].isSurplus ? 'green' : categoryAnalysis[category].isDeficit ? 'red' : 'grey'"
                  size="small"
                  class="mr-1"
                >
                  {{ categoryAnalysis[category].isSurplus ? 'mdi-trending-up' : categoryAnalysis[category].isDeficit ? 'mdi-trending-down' : 'mdi-minus' }}
                </v-icon>
                <span
                  :class="{
                    'text-green': categoryAnalysis[category].isSurplus,
                    'text-red': categoryAnalysis[category].isDeficit,
                    'text-grey': !categoryAnalysis[category].isSurplus && !categoryAnalysis[category].isDeficit
                  }"
                  class="text-body-2 font-weight-medium"
                >
                  {{ categoryAnalysis[category].isSurplus ? 'Surplus' : categoryAnalysis[category].isDeficit ? 'Deficit' : 'On Target' }}
                </span>
                <v-spacer></v-spacer>
                <span
                  :class="{
                    'text-green': categoryAnalysis[category].isSurplus,
                    'text-red': categoryAnalysis[category].isDeficit,
                    'text-grey': !categoryAnalysis[category].isSurplus && !categoryAnalysis[category].isDeficit
                  }"
                  class="text-body-2 font-weight-medium"
                >
                  {{ formatCurrency(Math.abs(categoryAnalysis[category].difference)) }}
                </span>
              </div>
            </v-card>
          </v-col>
        </v-row>
        
        <!-- Validation Message -->
        <v-alert
          v-if="editing && !targetsValid"
          type="warning"
          variant="tonal"
          class="mt-4"
        >
          <v-icon left>mdi-alert</v-icon>
          Target percentages must sum to exactly 100%
        </v-alert>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import CategoryTargets from './CategoryTargets.js'

const {
  targets,
  tempTargets,
  transactions,
  loading,
  editing,
  netIncome,
  actualSpending,
  targetAmounts,
  categoryAnalysis,
  historicalAverages,
  targetsValid,
  CATEGORY_NAMES,
  CATEGORY_COLORS,
  CATEGORY_STEPS,
  startEditing,
  cancelEditing,
  saveChanges,
  updateTarget,
  formatCurrency,
  formatPercentage
} = CategoryTargets.setup()
</script>

<style scoped>
.gap-2 {
  gap: 8px;
}
</style>
