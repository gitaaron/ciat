<template>
  <v-card>
    <v-card-title class="text-h5">
      <v-icon left>mdi-database</v-icon>
      Database Versions
    </v-card-title>

    <v-card-text>
      <!-- Status Bar -->
      <v-card variant="outlined" class="mb-4">
        <v-card-text>
          <v-row>
            <v-col cols="12" md="4">
              <v-chip color="info" variant="outlined" size="large">
                <v-icon left>mdi-counter</v-icon>
                Total Versions: {{ status.totalVersions }}
              </v-chip>
            </v-col>
            <v-col cols="12" md="4">
              <v-chip 
                :color="status.isUpToDate ? 'success' : 'warning'" 
                variant="outlined" 
                size="large"
              >
                <v-icon left>{{ status.isUpToDate ? 'mdi-check' : 'mdi-alert' }}</v-icon>
                {{ status.isUpToDate ? 'Up to date' : 'Uncommitted changes' }}
              </v-chip>
            </v-col>
            <v-col cols="12" md="4">
              <v-chip color="primary" variant="outlined" size="large">
                <v-icon left>mdi-clock</v-icon>
                Latest: {{ latestVersionInfo }}
              </v-chip>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Actions -->
      <v-row class="mb-4">
        <v-col cols="12" sm="6">
          <v-btn
            @click="createVersion"
            :disabled="loading"
            :loading="loading"
            color="primary"
            block
          >
            <v-icon left>mdi-plus</v-icon>
            Create Version
          </v-btn>
        </v-col>
        <v-col cols="12" sm="6">
          <v-btn
            @click="loadVersions"
            :disabled="loading"
            :loading="loading"
            color="secondary"
            variant="outlined"
            block
          >
            <v-icon left>mdi-refresh</v-icon>
            Refresh
          </v-btn>
        </v-col>
      </v-row>

      <!-- Loading State -->
      <v-progress-linear
        v-if="loading"
        indeterminate
        color="primary"
        class="mb-4"
      />

      <!-- Empty State -->
      <v-alert
        v-else-if="versions.length === 0"
        type="info"
        variant="outlined"
        class="text-center"
      >
        No versions found. Create your first version to get started.
      </v-alert>
      
      <!-- Versions List -->
      <v-card
        v-else
        variant="outlined"
        v-for="version in versions"
        :key="version.id"
        class="mb-3"
      >
        <v-card-title class="text-h6">
          <v-icon left>mdi-database</v-icon>
          {{ version.id.substring(0, 20) }}...
        </v-card-title>
        
        <v-card-text>
          <v-row>
            <v-col cols="12" md="4">
              <v-chip color="info" variant="outlined">
                <v-icon left>mdi-clock</v-icon>
                {{ formatTimestamp(version.timestamp) }}
              </v-chip>
            </v-col>
            <v-col cols="12" md="4">
              <v-chip color="secondary" variant="outlined">
                <v-icon left>mdi-text</v-icon>
                {{ version.description || 'No description' }}
              </v-chip>
            </v-col>
            <v-col cols="12" md="4">
              <v-chip color="primary" variant="outlined">
                <v-icon left>mdi-file</v-icon>
                {{ formatSize(version.size) }}
              </v-chip>
            </v-col>
          </v-row>
        </v-card-text>
        
        <v-card-actions>
          <v-btn
            @click="revertVersion(version.id)"
            color="warning"
            variant="outlined"
          >
            <v-icon left>mdi-undo</v-icon>
            Revert
          </v-btn>
          <v-btn
            @click="deleteVersion(version.id)"
            color="error"
            variant="outlined"
          >
            <v-icon left>mdi-delete</v-icon>
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script src="./DatabaseVersions.js"></script>
