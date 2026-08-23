<script setup lang="ts">
import { computed } from 'vue';

import type { StudentDictationPointSnapshot } from '../ui/students-page';

const props = defineProps<{
  studentName: string;
  points: StudentDictationPointSnapshot[];
}>();

interface ChartPoint extends StudentDictationPointSnapshot {
  index: number;
  x: number;
  y?: number;
}

const left = 42;
const right = 22;
const top = 18;
const plotHeight = 210;
const bottom = 52;
const ticks = [0, 20, 40, 60, 80, 100];
const height = top + plotHeight + bottom;

const width = computed(() => Math.max(560, left + right + Math.max(1, props.points.length - 1) * 78));
const xFor = (index: number): number => props.points.length === 1
  ? left + (width.value - left - right) / 2
  : left + index * ((width.value - left - right) / (props.points.length - 1));
const yFor = (rate: number): number => top + ((100 - rate) / 100) * plotHeight;

const chartPoints = computed<ChartPoint[]>(() => props.points.map((point, index) => ({
  ...point,
  index,
  x: xFor(index),
  y: point.rate === null ? undefined : yFor(point.rate),
})));
const numericPoints = computed(() => chartPoints.value.filter(
  (point): point is ChartPoint & { rate: number; y: number } => point.rate !== null && point.y !== undefined,
));
const segments = computed(() => {
  const result: Array<Array<ChartPoint & { rate: number; y: number }>> = [];
  numericPoints.value.forEach((point) => {
    const current = result[result.length - 1];
    if (!current || current[current.length - 1].index !== point.index - 1) result.push([point]);
    else current.push(point);
  });
  return result.filter((segment) => segment.length > 1);
});
const trend = computed(() => {
  const points = numericPoints.value;
  if (points.length < 2) return undefined;
  const count = points.length;
  const sumX = points.reduce((sum, point) => sum + point.index, 0);
  const sumY = points.reduce((sum, point) => sum + point.rate, 0);
  const sumXY = points.reduce((sum, point) => sum + point.index * point.rate, 0);
  const sumXX = points.reduce((sum, point) => sum + point.index * point.index, 0);
  const denominator = count * sumXX - sumX * sumX;
  if (denominator === 0) return undefined;
  const slope = (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / count;
  const lastIndex = props.points.length - 1;
  const clamp = (value: number): number => Math.max(0, Math.min(100, value));
  return {
    x1: xFor(0),
    y1: yFor(clamp(intercept)),
    x2: xFor(lastIndex),
    y2: yFor(clamp(intercept + slope * lastIndex)),
  };
});
const shortLabel = (name: string): string => name.length > 14 ? `${name.slice(0, 12)}…` : name;
</script>

<template>
  <div
    v-if="!numericPoints.length"
    class="dictation-chart-empty"
  >
    <span class="icon"><svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    ><rect
      x="3"
      y="4"
      width="18"
      height="16"
      rx="2"
    /><path d="M3 9h18M9 9v11M15 9v11" /></svg></span>
    <strong>Aucun résultat de dictée</strong>
    <span>La courbe apparaîtra dès qu’un premier résultat sera saisi.</span>
  </div>
  <div
    v-else
    class="dictation-chart-card"
  >
    <div class="dictation-chart-legend">
      <span><i class="result-line" />Résultats</span>
      <span v-if="trend"><i class="trend-line" />Tendance</span>
    </div>
    <div class="dictation-chart-scroll">
      <svg
        class="dictation-chart"
        :viewBox="`0 0 ${width} ${height}`"
        :style="{ minWidth: `${width}px` }"
        role="img"
        :aria-label="`Progression de ${studentName} en dictée, de 0 à 100 pour cent`"
      >
        <g
          v-for="tick in ticks"
          :key="tick"
        >
          <line
            class="dictation-chart-grid"
            :x1="left"
            :y1="yFor(tick)"
            :x2="width - right"
            :y2="yFor(tick)"
          />
          <text
            class="dictation-chart-y-label"
            :x="left - 8"
            :y="yFor(tick) + 3"
          >{{ tick }} %</text>
        </g>
        <line
          v-if="trend"
          class="dictation-chart-trend"
          :x1="trend.x1"
          :y1="trend.y1"
          :x2="trend.x2"
          :y2="trend.y2"
        />
        <polyline
          v-for="(segment, index) in segments"
          :key="index"
          class="dictation-chart-line"
          :points="segment.map((point) => `${point.x},${point.y}`).join(' ')"
        />
        <template
          v-for="point in chartPoints"
          :key="point.id"
        >
          <circle
            v-if="point.rate !== null"
            class="dictation-chart-point"
            :cx="point.x"
            :cy="point.y"
            r="4.5"
          >
            <title>{{ point.name }} · {{ point.rate.toFixed(2) }} % · Niveau {{ point.level }}</title>
          </circle>
          <text
            class="dictation-chart-x-label"
            :x="point.x"
            :y="top + plotHeight + 22"
            :transform="`rotate(-30 ${point.x} ${top + plotHeight + 22})`"
          >{{ shortLabel(point.name) }}</text>
        </template>
      </svg>
    </div>
  </div>
</template>
