<template>
  <v-card>
    <v-card-title class="text-h5 d-flex justify-space-between align-center my-4">
      <div class="d-flex align-center">
        <v-icon left>mdi-format-list-checks</v-icon>
        Bucket List
      </div>
        <v-btn
          @click="openAddDialog"
          color="primary"
          prepend-icon="mdi-plus"
        >
          Add Item
        </v-btn>

    </v-card-title>
    
    <v-card-text>
      <!-- Loading State -->
      <div v-if="loading" class="text-center pa-4">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading transactions...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="items.length === 0" class="text-center pa-8">
        <v-icon size="64" color="grey" class="mb-4">mdi-format-list-checks</v-icon>
        <h3 class="text-h6 mb-2">No items in your bucket list yet</h3>
        <p class="text-body-2 text-grey">Start adding future purchases you'd like to save for!</p>
      </div>

      <!-- Items List -->
      <div v-else>
        <!-- Stats Display -->
        <v-card class="mb-4" variant="outlined">
          <v-card-text>
            <v-row>
              <v-col cols="12" md="3">
                <div class="stat-item">
                  <div 
                    class="stat-value" 
                    :class="totalSurplus >= 0 ? 'stat-surplus' : 'stat-deficit'"
                  >
                    {{ formatCurrency(totalSurplus) }}
                  </div>
                  <div class="stat-label">{{ totalSurplus >= 0 ? 'Short Term Surplus' : 'Short Term Deficit' }}</div>
                </div>
              </v-col>
              <v-col cols="12" md="3">
                <div class="stat-item">
                  <div class="stat-value">{{ formatCurrency(totalCost) }}</div>
                  <div class="stat-label">Total Cost</div>
                </div>
              </v-col>
              <v-col cols="12" md="3">
                <div class="stat-item">
                  <div class="stat-value">{{ formatCurrency(monthlySpend) }}</div>
                  <div class="stat-label">Monthly Spend</div>
                </div>
              </v-col>
              <v-col cols="12" md="3">
                <div class="stat-item">
                  <div class="stat-value">{{ formatCurrency(targetSavings) }}</div>
                  <div class="stat-label d-flex align-center justify-center">
                    <span>Target Savings</span>
                    <v-btn
                      icon
                      variant="text"
                      size="x-small"
                      @click="startEditingTargetSavings"
                      class="ml-1"
                    >
                      <v-icon size="small">mdi-pencil</v-icon>
                    </v-btn>
                  </div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-list>
        <v-list-item
          v-for="item in itemsWithAffordability"
          :key="item.id"
          class="mb-2"
        >
          <template v-slot:prepend>
            <v-icon 
              :color="item.canAfford ? 'success' : 'error'" 
              size="large"
            >
              {{ item.canAfford ? 'mdi-check-circle' : 'mdi-close-circle' }}
            </v-icon>
          </template>

          <v-list-item-title class="text-h6 mb-1">
            {{ item.name }}
          </v-list-item-title>
          
          <v-list-item-subtitle v-if="item.description" class="mb-2">
            {{ item.description }}
          </v-list-item-subtitle>

          <v-list-item-subtitle v-if="item.estimatedCost" class="text-primary font-weight-bold mb-1">
            Estimated Cost: {{ formatCurrency(item.estimatedCost) }}
          </v-list-item-subtitle>

          <v-list-item-subtitle 
            :class="item.canAfford ? 'text-success' : 'text-error'"
            class="font-weight-bold"
          >
            Remaining: {{ formatCurrency(item.remainingSurplus) }}
          </v-list-item-subtitle>
          
          <v-list-item-subtitle 
            v-if="item.monthsToAfford !== null"
            class="text-error mt-1"
          >
            {{ item.monthsToAfford }} {{ item.monthsToAfford === 1 ? 'month' : 'months' }} to afford it
          </v-list-item-subtitle>

          <template v-slot:append>
            <div class="d-flex gap-2">
              <v-btn
                icon
                variant="text"
                size="small"
                @click="openEditDialog(items.find(i => i.id === item.id))"
                color="primary"
              >
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
              <v-btn
                icon
                variant="text"
                size="small"
                @click="confirmDelete(items.find(i => i.id === item.id))"
                color="error"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </div>
          </template>
        </v-list-item>
        </v-list>
      </div>

      <!-- Add/Edit Dialog -->
      <v-dialog v-model="showDialog" max-width="600" persistent>
        <v-card>
          <v-card-title>
            <span class="text-h6">{{ editingItem ? 'Edit Item' : 'Add New Item' }}</span>
          </v-card-title>
          
          <v-card-text>
            <v-form ref="formRef" v-model="formValid">
              <v-text-field
                v-model="formData.name"
                label="Item Name *"
                :rules="[rules.required]"
                variant="outlined"
                class="mb-3"
                autofocus
              ></v-text-field>

              <v-textarea
                v-model="formData.description"
                label="Description"
                variant="outlined"
                rows="3"
                class="mb-3"
              ></v-textarea>

              <v-text-field
                v-model.number="formData.estimatedCost"
                label="Estimated Cost"
                type="number"
                min="0"
                step="0.01"
                prefix="$"
                variant="outlined"
                class="mb-3"
              ></v-text-field>
            </v-form>
          </v-card-text>

          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              @click="closeDialog"
              variant="text"
            >
              Cancel
            </v-btn>
            <v-btn
              @click="saveItem"
              color="primary"
              :disabled="!formValid"
            >
              {{ editingItem ? 'Save' : 'Add' }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Delete Confirmation Dialog -->
      <v-dialog v-model="showDeleteDialog" max-width="400">
        <v-card>
          <v-card-title class="text-h6">
            Confirm Delete
          </v-card-title>
          <v-card-text>
            Are you sure you want to delete "{{ itemToDelete?.name }}"? This action cannot be undone.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              @click="showDeleteDialog = false"
              variant="text"
            >
              Cancel
            </v-btn>
            <v-btn
              @click="deleteItem"
              color="error"
            >
              Delete
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Target Savings Configuration Dialog -->
      <v-dialog v-model="showTargetSavingsDialog" max-width="400">
        <v-card>
          <v-card-title class="text-h6">
            Configure Target Savings
          </v-card-title>
          <v-card-text>
            <p class="text-body-2 mb-4">
              Target savings is calculated as a percentage of monthly spend. 
              Default is 10%.
            </p>
            <v-text-field
              v-model.number="targetSavingsPercentage"
              label="Target Savings Percentage"
              type="number"
              min="0"
              max="100"
              step="0.1"
              suffix="%"
              variant="outlined"
            ></v-text-field>
            <div class="mt-2 text-body-2 text-grey">
              Current monthly spend: {{ formatCurrency(monthlySpend) }}
            </div>
            <div class="mt-1 text-body-2 text-grey">
              Target savings: {{ formatCurrency(targetSavings) }}
            </div>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              @click="cancelEditingTargetSavings"
              variant="text"
            >
              Cancel
            </v-btn>
            <v-btn
              @click="saveTargetSavings"
              color="primary"
              :loading="loading"
            >
              Save
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import BucketList from './BucketList.js'

const {
  items,
  showDialog,
  showDeleteDialog,
  editingItem,
  itemToDelete,
  formData,
  formValid,
  formRef,
  rules,
  formatCurrency,
  loadItems,
  openAddDialog,
  openEditDialog,
  closeDialog,
  saveItem,
  confirmDelete,
  deleteItem,
  loading,
  totalSurplus,
  totalCost,
  itemsWithAffordability,
  loadTransactions,
  loadTargets,
  monthlySpend,
  targetSavings,
  targetSavingsPercentage,
  showTargetSavingsDialog,
  editingTargetSavings,
  loadTargetSavings,
  saveTargetSavings,
  startEditingTargetSavings,
  cancelEditingTargetSavings
} = BucketList.setup()

onMounted(async () => {
  await loadTargets()
  await loadTargetSavings()
  await loadItems()
  await loadTransactions()
})
</script>

<style scoped>
.gap-2 {
  gap: 8px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1976d2;
  margin-bottom: 0.25rem;
}

.stat-value.stat-surplus {
  color: #4caf50;
}

.stat-value.stat-deficit {
  color: #f44336;
}

.stat-label {
  font-size: 0.875rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>

