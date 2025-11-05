
<script setup>
import * as d3 from 'd3'
import { onMounted, ref, computed } from 'vue'
import api from './api.js'
import { CATEGORY_NAMES, CATEGORY_COLORS, CATEGORY_STEPS } from '../config/categories.js'

const el = ref(null)
const transactions = ref([])
const loading = ref(true)

// Color scale for categories
const colorScale = d3.scaleOrdinal()
  .domain(CATEGORY_STEPS)
  .range([
    '#1976d2', // blue for fixed_costs
    '#388e3c', // green for investments  
    '#e91e63', // pink for guilt_free
    '#ff9800'  // orange for short_term_savings
  ])

async function loadTransactions() {
  try {
    loading.value = true
    transactions.value = await api.listTransactions()
  } catch (error) {
    console.error('Error loading transactions:', error)
  } finally {
    loading.value = false
  }
}

// Filter to only expense transactions with valid categories
const chartData = computed(() => {
  const expenseTransactions = transactions.value.filter(tx => 
    tx.inflow === 0 && 
    tx.category && 
    CATEGORY_STEPS.includes(tx.category)
  )
  
  const totals = d3.rollups(
    expenseTransactions, 
    v => d3.sum(v, d => Number(d.amount)), 
    d => d.category
  )
  
  return totals.map(([category, value]) => ({
    category,
    label: CATEGORY_NAMES[category],
    value: value,
    color: colorScale(category)
  })).filter(d => d.value > 0)
})

async function draw() {
  if (loading.value) return
  
  const data = chartData.value
  
  if (data.length === 0) {
    d3.select(el.value).html(`
      <div class="text-center pa-8">
        <v-icon size="48" color="grey">mdi-chart-pie</v-icon>
        <p class="text-h6 mt-2">No spending data</p>
        <p class="text-body-2">Import transactions to see category breakdown</p>
      </div>
    `)
    return
  }
  
  const width = 480
  const height = 320
  const radius = Math.min(width, height) / 2 - 20
  
  // Clear previous content
  d3.select(el.value).html('')
  
  const svg = d3.select(el.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('max-width', '100%')
    .style('height', 'auto')
  
  const g = svg.append('g')
    .attr('transform', `translate(${width/2},${height/2})`)
  
  // Create pie generator
  const pie = d3.pie()
    .value(d => d.value)
    .sort(null)
  
  // Create arc generator
  const arc = d3.arc()
    .innerRadius(radius * 0.4)
    .outerRadius(radius)
  
  // Create outer arc for labels
  const outerArc = d3.arc()
    .innerRadius(radius * 1.1)
    .outerRadius(radius * 1.1)
  
  // Generate pie data
  const pieData = pie(data)
  
  // Create arcs
  const arcs = g.selectAll('.arc')
    .data(pieData)
    .enter()
    .append('g')
    .attr('class', 'arc')
  
  // Add path elements
  arcs.append('path')
    .attr('d', arc)
    .attr('fill', d => d.data.color)
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', 'scale(1.05)')
    })
    .on('mouseout', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', 'scale(1)')
    })
  
  // Add labels
  arcs.append('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', '#fff')
    .text(d => d.data.label)
  
  // Add percentage labels
  arcs.append('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .attr('dy', '1.2em')
    .style('font-size', '10px')
    .style('fill', '#fff')
    .text(d => `${((d.endAngle - d.startAngle) / (2 * Math.PI) * 100).toFixed(1)}%`)
  
  // Add legend
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 120}, 20)`)
  
  const legendItems = legend.selectAll('.legend-item')
    .data(data)
    .enter()
    .append('g')
    .attr('class', 'legend-item')
    .attr('transform', (d, i) => `translate(0, ${i * 20})`)
  
  legendItems.append('rect')
    .attr('width', 12)
    .attr('height', 12)
    .attr('fill', d => d.color)
    .attr('rx', 2)
  
  legendItems.append('text')
    .attr('x', 16)
    .attr('y', 9)
    .style('font-size', '11px')
    .style('fill', '#333')
    .text(d => d.label)
}

async function refresh() {
  await loadTransactions()
  draw()
}

onMounted(async () => {
  await refresh()
})

defineExpose({
  refresh
})
</script>
<template>
  <v-card>
    <v-card-title class="text-h6">
      <v-icon left>mdi-chart-pie</v-icon>
      Category Breakdown (Pie)
    </v-card-title>
    <v-card-text>
      <div ref="el" class="chart-container"></div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.chart-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}
</style>
