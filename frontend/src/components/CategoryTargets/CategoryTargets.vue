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
      
      <div v-else-if="monthlyNetIncome <= 0" class="text-center pa-4">
        <v-icon size="48" color="grey">mdi-information</v-icon>
        <p class="text-h6 mt-2">No income data available</p>
        <p class="text-body-2">Import transactions to set up category targets</p>
      </div>
      
      <div v-else>
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
              
              <!-- Target vs Actual Table -->
              <v-table density="compact" class="mb-2">
                <thead>
                  <tr>
                    <th class="text-left text-caption"></th>
                    <th class="text-center text-caption">Monthly</th>
                    <th class="text-center text-caption">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="text-body-2 font-weight-medium">Target</td>
                    <td class="text-center text-body-2">{{ formatCurrency(monthlyTarget[category]) }}</td>
                    <td class="text-center text-body-2">{{ formatCurrency(totalTarget[category]) }}</td>
                  </tr>
                  <tr>
                    <td class="text-body-2 font-weight-medium">Actual</td>
                    <td class="text-center text-body-2">{{ formatCurrency(monthlyActual[category]) }}</td>
                    <td class="text-center text-body-2">{{ formatCurrency(totalActual[category]) }}</td>
                  </tr>
                </tbody>
              </v-table>
              
              <!-- Deviation -->
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
                  Deviation
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
                  {{ categoryAnalysis[category].difference > 0 ? '+' : '' }}{{ formatCurrency(categoryAnalysis[category].difference) }}
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
  totalNetIncome,
  monthlyNetIncome,
  annualNetIncome,
  dateRange,
  monthlyActual,
  totalActual,
  targetAmounts,
  monthlyTarget,
  totalTarget,
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
