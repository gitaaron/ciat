
<script setup>
import * as d3 from 'd3'
import { onMounted, ref } from 'vue'
import api from './api.js'

const el = ref(null)
async function draw() {
  const rows = await api.listTransactions()
  const totals = d3.rollups(rows, v => d3.sum(v, d => d.amount*(d.inflow? -1:1)), d => d.category || '(none)')
  const data = totals.map(([k,v]) => ({ label: k, value: Math.abs(v) }))
  const width = 480, height = 320, r = Math.min(width, height)/2 - 8
  const svg = d3.select(el.value).html('').append('svg').attr('width', width).attr('height', height)
  const g = svg.append('g').attr('transform', `translate(${width/2},${height/2})`)
  const pie = d3.pie().value(d => d.value)(data)
  const arc = d3.arc().innerRadius(40).outerRadius(r)
  const arcs = g.selectAll('path').data(pie).enter().append('path').attr('d', arc)
  g.selectAll('text').data(pie).enter().append('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)
    .attr('text-anchor','middle').attr('dy','.35em').text(d => d.data.label)
}
onMounted(draw)
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
