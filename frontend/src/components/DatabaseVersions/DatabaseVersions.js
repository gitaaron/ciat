import { ref, onMounted, computed } from 'vue'
import api from '../api.js'

export default {
  name: 'DatabaseVersions',
  setup() {
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

    return {
      versions,
      status,
      loading,
      latestVersionInfo,
      loadVersions,
      createVersion,
      revertVersion,
      deleteVersion,
      formatTimestamp,
      formatSize
    }
  }
}