<template>
  <v-card>
    <v-card-title class="text-h6">
      <v-icon left>mdi-table-cog</v-icon>
      Map CSV Fields
    </v-card-title>
    
    <v-card-text>
      <p class="text-body-2 mb-4">
        Click on each column header below to assign it to a field type. You must assign one column to each: Date, Merchant Name, Inflow (Income), and Outflow (Expense).
      </p>
      
      <!-- Field Mapping Status -->
      <v-alert 
        v-if="!isMappingComplete" 
        type="warning" 
        variant="tonal" 
        class="mb-4"
      >
        <strong>Missing mappings:</strong> {{ missingFields.join(', ') }}
      </v-alert>
      
      <v-alert 
        v-else 
        type="success" 
        variant="tonal" 
        class="mb-4"
      >
        All required fields are mapped!
      </v-alert>
      
      <!-- Preview Table with Clickable Headers -->
      <v-card variant="outlined">
        <v-card-title class="text-subtitle-1">Preview (First 5 Transactions)</v-card-title>
        <v-card-text>
          <v-table v-if="previewData.length > 0" density="compact">
            <thead>
              <tr>
                <th 
                  v-for="(column, index) in csvColumns" 
                  :key="index"
                  class="text-left"
                  :class="{ 'mapped-header': getFieldForColumn(column) }"
                >
                  <v-menu>
                    <template v-slot:activator="{ props: menuProps }">
                      <div 
                        v-bind="menuProps"
                        class="header-clickable"
                        :class="{ 'header-unmapped': !getFieldForColumn(column) }"
                      >
                        <span class="header-label">
                          <span v-if="getFieldForColumn(column)">
                            {{ getFieldLabel(getFieldForColumn(column)) }}
                          </span>
                          <span v-else>{{ column }}</span>
                        </span>
                        <v-icon size="small" class="ml-1">mdi-menu-down</v-icon>
                      </div>
                    </template>
                    <v-list>
                      <v-list-item
                        v-for="field in fieldOptions"
                        :key="field.value"
                        @click="assignFieldToColumn(column, field.value)"
                        :disabled="isFieldAlreadyMapped(field.value) && getFieldForColumn(column) !== field.value"
                      >
                        <v-list-item-title>
                          <v-icon 
                            v-if="getFieldForColumn(column) === field.value"
                            size="small"
                            color="primary"
                            class="mr-2"
                          >
                            mdi-check
                          </v-icon>
                          {{ field.label }}
                        </v-list-item-title>
                      </v-list-item>
                      <v-list-item
                        v-if="getFieldForColumn(column)"
                        @click="clearColumnMapping(column)"
                      >
                        <v-list-item-title class="text-error">
                          <v-icon size="small" class="mr-2">mdi-close</v-icon>
                          Clear Mapping
                        </v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in previewData" :key="index">
                <td v-for="(column, colIndex) in csvColumns" :key="colIndex">
                  {{ getFieldValue(row, column) || '-' }}
                </td>
              </tr>
            </tbody>
          </v-table>
          <v-alert v-else type="info" variant="tonal">
            No preview data available. Please upload a CSV file first.
          </v-alert>
        </v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script src="./FieldMapping.js"></script>
<style scoped src="./FieldMapping.css"></style>

