<template>
  <div class="database-versions">
    <h2>Database Versions</h2>
    
    <div class="status-bar">
      <div class="status-item">
        <strong>Total Versions:</strong> {{ status.totalVersions }}
      </div>
      <div class="status-item">
        <strong>Status:</strong> 
        <span :class="status.isUpToDate ? 'status-ok' : 'status-warning'">
          {{ status.isUpToDate ? 'Up to date' : 'Uncommitted changes' }}
        </span>
      </div>
      <div class="status-item">
        <strong>Latest:</strong> {{ latestVersionInfo }}
      </div>
    </div>

    <div class="actions">
      <button @click="createVersion" :disabled="loading" class="btn btn-primary">
        Create Version
      </button>
      <button @click="loadVersions" :disabled="loading" class="btn btn-secondary">
        Refresh
      </button>
    </div>

    <div v-if="loading" class="loading">Loading versions...</div>
    
    <div v-else-if="versions.length === 0" class="empty">
      No versions found. Create your first version to get started.
    </div>
    
    <div v-else class="versions-list">
      <div v-for="version in versions" :key="version.id" class="version-item">
        <div class="version-header">
          <div class="version-id">{{ version.id.substring(0, 20) }}...</div>
          <div class="version-actions">
            <button @click="revertVersion(version.id)" class="btn btn-warning btn-sm">
              Revert
            </button>
            <button @click="deleteVersion(version.id)" class="btn btn-danger btn-sm">
              Delete
            </button>
          </div>
        </div>
        <div class="version-details">
          <div class="version-timestamp">{{ formatTimestamp(version.timestamp) }}</div>
          <div class="version-description">{{ version.description || 'No description' }}</div>
          <div class="version-size">{{ formatSize(version.size) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from './api.js'

const versions = ref([])
const status = ref({
  totalVersions: 0,
  isUpToDate: true,
  latestVersion: null
})
const loading = ref(false)

const latestVersionInfo = computed(() => {
  if (!status.value.latestVersion) return 'None'
  const date = new Date(status.value.latestVersion.timestamp)
  return date.toLocaleString()
})

async function loadVersions() {
  loading.value = true
  try {
    const [versionsData, statusData] = await Promise.all([
      api.get('/versions'),
      api.get('/versions/status')
    ])
    versions.value = versionsData
    status.value = statusData
  } catch (error) {
    console.error('Failed to load versions:', error)
    alert('Failed to load versions: ' + error.message)
  } finally {
    loading.value = false
  }
}

async function createVersion() {
  const description = prompt('Enter a description for this version:')
  if (!description) return
  
  loading.value = true
  try {
    await api.post('/versions', { description })
    await loadVersions()
    alert('Version created successfully!')
  } catch (error) {
    console.error('Failed to create version:', error)
    alert('Failed to create version: ' + error.message)
  } finally {
    loading.value = false
  }
}

async function revertVersion(versionId) {
  if (!confirm(`Are you sure you want to revert to version ${versionId}? This will create a backup of the current database.`)) {
    return
  }
  
  loading.value = true
  try {
    await api.post(`/versions/${versionId}/revert`)
    await loadVersions()
    alert('Successfully reverted to the selected version!')
  } catch (error) {
    console.error('Failed to revert version:', error)
    alert('Failed to revert version: ' + error.message)
  } finally {
    loading.value = false
  }
}

async function deleteVersion(versionId) {
  if (!confirm(`Are you sure you want to delete version ${versionId}? This action cannot be undone.`)) {
    return
  }
  
  loading.value = true
  try {
    await api.delete(`/versions/${versionId}`)
    await loadVersions()
    alert('Version deleted successfully!')
  } catch (error) {
    console.error('Failed to delete version:', error)
    alert('Failed to delete version: ' + error.message)
  } finally {
    loading.value = false
  }
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString()
}

function formatSize(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB'
}

onMounted(loadVersions)
</script>

<style scoped>
.database-versions {
  max-width: 800px;
}

.status-bar {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-ok {
  color: #28a745;
  font-weight: bold;
}

.status-warning {
  color: #ffc107;
  font-weight: bold;
}

.actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border-color: #6c757d;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-warning {
  background: #ffc107;
  color: #212529;
  border-color: #ffc107;
}

.btn-warning:hover:not(:disabled) {
  background: #e0a800;
}

.btn-danger {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.versions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-item {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  background: white;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.version-id {
  font-family: monospace;
  font-weight: bold;
  color: #495057;
}

.version-actions {
  display: flex;
  gap: 8px;
}

.version-details {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 16px;
  font-size: 14px;
  color: #6c757d;
}

.version-description {
  font-style: italic;
}
</style>
