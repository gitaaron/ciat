<template>
  <!-- Global Snackbar -->
  <v-snackbar
    v-model="snackbar.show"
    :color="snackbar.color"
    :timeout="snackbar.timeout"
    location="top right"
    variant="elevated"
  >
    <div class="d-flex align-center">
      <v-icon 
        v-if="snackbar.color === 'success'" 
        left 
        color="white"
      >
        mdi-check-circle
      </v-icon>
      <v-icon 
        v-else-if="snackbar.color === 'error'" 
        left 
        color="white"
      >
        mdi-alert-circle
      </v-icon>
      <v-icon 
        v-else-if="snackbar.color === 'warning'" 
        left 
        color="white"
      >
        mdi-alert
      </v-icon>
      <v-icon 
        v-else 
        left 
        color="white"
      >
        mdi-information
      </v-icon>
      <span class="ml-2">{{ snackbar.message }}</span>
    </div>
    
    <template v-slot:actions>
      <v-btn
        color="white"
        variant="text"
        @click="snackbar.show = false"
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </template>
  </v-snackbar>

  <!-- Global Confirm Dialog -->
  <v-dialog
    v-model="confirmDialog.show"
    max-width="500"
    persistent
  >
    <v-card>
      <v-card-title class="text-h6">
        <v-icon 
          left 
          :color="confirmDialog.color"
        >
          <template v-if="confirmDialog.color === 'error'">mdi-alert-circle</template>
          <template v-else-if="confirmDialog.color === 'warning'">mdi-alert</template>
          <template v-else>mdi-help-circle</template>
        </v-icon>
        {{ confirmDialog.title }}
      </v-card-title>
      
      <v-card-text>
        <p class="text-body-1">{{ confirmDialog.message }}</p>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="confirmDialog.onCancel"
        >
          {{ confirmDialog.cancelText }}
        </v-btn>
        <v-btn
          :color="confirmDialog.color"
          variant="elevated"
          @click="confirmDialog.onConfirm"
        >
          {{ confirmDialog.confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { snackbar, confirmDialog } from '../utils/notifications.js'
</script>
