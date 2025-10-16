<template>
  <v-autocomplete
    v-model="selectedLabel"
    :items="labelItems"
    :loading="loading"
    :search="search"
    clearable
    hide-no-data
    hide-selected
    item-title="title"
    item-value="value"
    :label="label"
    :placeholder="placeholder"
    :hint="hint"
    :persistent-hint="!!hint"
    variant="outlined"
    density="compact"
    @update:search="onSearch"
    @update:model-value="onSelectionChange"
  >
    <template v-slot:no-data>
      <v-list-item>
        <v-list-item-title>
          No existing labels found
        </v-list-item-title>
      </v-list-item>
      <v-list-item v-if="search && search.length > 0" @click="createNewLabel">
        <v-list-item-title class="text-primary">
          <v-icon left>mdi-plus</v-icon>
          Create "{{ search }}"
        </v-list-item-title>
      </v-list-item>
    </template>
    
    <template v-slot:item="{ props, item }">
      <v-list-item v-bind="props">
        <template v-if="item.raw.isNew">
          <v-list-item-title class="text-primary">
            <v-icon left>mdi-plus</v-icon>
            Create "{{ item.raw.title }}"
          </v-list-item-title>
        </template>
        <template v-else>
          <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
        </template>
      </v-list-item>
    </template>
  </v-autocomplete>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from './api.js'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: 'Label (Optional)'
  },
  placeholder: {
    type: String,
    default: 'e.g., Coffee, Travel, Work'
  },
  hint: {
    type: String,
    default: 'Optional label for grouping transactions'
  }
})

const emit = defineEmits(['update:modelValue'])

const selectedLabel = ref(props.modelValue)
const search = ref('')
const loading = ref(false)
const existingLabels = ref([])

const labelItems = computed(() => {
  const items = existingLabels.value.map(label => ({
    title: label,
    value: label,
    isNew: false
  }))
  
  // If user is typing something that doesn't exist, show option to create it
  if (search.value && search.value.length > 0 && !existingLabels.value.includes(search.value)) {
    items.push({
      title: search.value,
      value: search.value,
      isNew: true
    })
  }
  
  return items
})

async function loadLabels() {
  loading.value = true
  try {
    existingLabels.value = await api.getLabels()
  } catch (error) {
    console.error('Failed to load labels:', error)
    existingLabels.value = []
  } finally {
    loading.value = false
  }
}

function onSearch(value) {
  search.value = value
}

function onSelectionChange(value) {
  selectedLabel.value = value
  emit('update:modelValue', value || '')
}

function createNewLabel() {
  if (search.value && search.value.length > 0) {
    selectedLabel.value = search.value
    emit('update:modelValue', search.value)
  }
}

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  selectedLabel.value = newValue
})

onMounted(() => {
  loadLabels()
})
</script>
