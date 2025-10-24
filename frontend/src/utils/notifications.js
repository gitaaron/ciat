import { ref } from 'vue'

// Global notification state
const snackbar = ref({
  show: false,
  message: '',
  color: 'info',
  timeout: 4000
})

const confirmDialog = ref({
  show: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  color: 'primary',
  onConfirm: null,
  onCancel: null
})

// Snackbar functions
export function showSnackbar(message, color = 'info', timeout = 4000) {
  snackbar.value = {
    show: true,
    message,
    color,
    timeout
  }
}

export function showSuccess(message, timeout = 4000) {
  showSnackbar(message, 'success', timeout)
}

export function showError(message, timeout = 6000) {
  showSnackbar(message, 'error', timeout)
}

export function showWarning(message, timeout = 5000) {
  showSnackbar(message, 'warning', timeout)
}

export function showInfo(message, timeout = 4000) {
  showSnackbar(message, 'info', timeout)
}

// Dialog functions
export function showConfirmDialog(options) {
  return new Promise((resolve) => {
    confirmDialog.value = {
      show: true,
      title: options.title || 'Confirm Action',
      message: options.message || 'Are you sure?',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      color: options.color || 'primary',
      onConfirm: () => {
        confirmDialog.value.show = false
        resolve(true)
      },
      onCancel: () => {
        confirmDialog.value.show = false
        resolve(false)
      }
    }
  })
}

export function showDeleteConfirm(message, title = 'Confirm Deletion') {
  return showConfirmDialog({
    title,
    message,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    color: 'error'
  })
}

export function showRevertConfirm(message, title = 'Confirm Revert') {
  return showConfirmDialog({
    title,
    message,
    confirmText: 'Revert',
    cancelText: 'Cancel',
    color: 'warning'
  })
}

// Export reactive state for components
export { snackbar, confirmDialog }
