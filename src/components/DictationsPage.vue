<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { computed } from 'vue';

import type {
  DictationColumnSnapshot,
  DictationScoreSnapshot,
  DictationsPageSnapshot,
} from '../ui/dictations-page';

const props = defineProps<{
  snapshot: DictationsPageSnapshot;
}>();

const emit = defineEmits<{
  (event: 'search', value: string): void;
  (event: 'create'): void;
  (event: 'manage-levels'): void;
  (event: 'edit', dictationId: string): void;
  (event: 'remove', dictationId: string): void;
  (event: 'edit-result', studentId: string, dictationId: string): void;
}>();

interface ChartPoint {
  dictation: DictationColumnSnapshot;
  index: number;
  rate: number | null;
  x: number;
  y?: number;
}

const chartLeft = 42;
const chartRight = 22;
const chartTop = 18;
const chartPlotHeight = 210;
const chartBottom = 52;
const chartTicks = [0, 20, 40, 60, 80, 100];

const chartWidth = computed(() => Math.max(
  720,
  chartLeft + chartRight + Math.max(1, props.snapshot.dictations.length - 1) * 86,
));
const chartHeight = chartTop + chartPlotHeight + chartBottom;
const chartY = (rate: number): number => chartTop + ((100 - rate) / 100) * chartPlotHeight;
const chartX = (index: number): number => props.snapshot.dictations.length === 1
  ? chartLeft + (chartWidth.value - chartLeft - chartRight) / 2
  : chartLeft + index * ((chartWidth.value - chartLeft - chartRight) / (props.snapshot.dictations.length - 1));

const chartPoints = computed<ChartPoint[]>(() => props.snapshot.dictations.map((dictation, index) => ({
  dictation,
  index,
  rate: dictation.average,
  x: chartX(index),
  y: dictation.average === null ? undefined : chartY(dictation.average),
})));

const chartSegments = computed(() => {
  const segments: ChartPoint[][] = [];
  chartPoints.value.forEach((point) => {
    if (point.rate === null) return;
    const current = segments[segments.length - 1];
    if (!current || current[current.length - 1].index !== point.index - 1) segments.push([point]);
    else current.push(point);
  });
  return segments.filter((segment) => segment.length > 1);
});

const hasChartData = computed(() => chartPoints.value.some((point) => point.rate !== null));
const scoreIndex = computed(() => new Map(
  props.snapshot.scores.map((score) => [`${score.studentId}\u0000${score.dictationId}`, score]),
));

const scoreFor = (studentId: string, dictationId: string): DictationScoreSnapshot | undefined =>
  scoreIndex.value.get(`${studentId}\u0000${dictationId}`);
const rateTone = (rate: number): string => rate >= 90 ? 'success' : rate >= 80 ? 'warning' : 'danger';
const scoreClass = (score?: DictationScoreSnapshot): string => {
  if (!score || score.kind === 'empty') return 'empty';
  if (score.kind === 'absent') return 'absent';
  return rateTone(score.rate ?? 0);
};
const scoreTitle = (score?: DictationScoreSnapshot): string => {
  if (!score) return '';
  if (score.kind === 'absent') return `Élève absent · Niveau ${score.level}`;
  if (score.kind === 'empty') return `Saisir le nombre d’erreurs · Niveau ${score.level}, ${score.wordCount} mots`;
  const mistakes = score.mistakeCount ?? 0;
  return `${mistakes} erreur${mistakes > 1 ? 's' : ''} sur ${score.wordCount} mots · Niveau ${score.level}`;
};
const shortChartLabel = (name: string): string => name.length > 16 ? `${name.slice(0, 14)}…` : name;
const updateSearch = (value: string | undefined): void => emit('search', value ?? '');
</script>

<template>
  <main class="workspace evaluation-workspace dictation-workspace">
    <header class="page-header">
      <div>
        <p class="eyebrow">
          Évaluation / Dictée
        </p>
        <h1>Dictée</h1>
        <p class="subtitle">
          Chaque niveau possède son propre nombre de mots et reste mémorisé pour chaque élève.
        </p>
      </div>
      <div class="page-header-actions">
        <Button
          unstyled
          class="secondary-button"
          label="Niveaux des élèves"
          @click="emit('manage-levels')"
        />
        <Button
          unstyled
          class="primary-button"
          @click="emit('create')"
        >
          <span class="icon"><svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          ><path d="M12 5v14M5 12h14" /></svg></span>
          Nouvelle dictée
        </Button>
      </div>
    </header>

    <div class="evaluation-tools">
      <label class="search-field">
        <span class="icon"><svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><circle
          cx="11"
          cy="11"
          r="8"
        /><path d="m21 21-4.35-4.35" /></svg></span>
        <InputText
          unstyled
          type="search"
          :model-value="snapshot.search"
          placeholder="Rechercher un élève…"
          aria-label="Rechercher un élève"
          @update:model-value="updateSearch"
        />
      </label>
      <div class="dictation-legend">
        <span><i class="legend-dot dictation-success" /> 90 à 100 %</span>
        <span><i class="legend-dot dictation-warning" /> 80 à 89,99 %</span>
        <span><i class="legend-dot dictation-danger" /> moins de 80 %</span>
      </div>
    </div>

    <section class="class-progress-section">
      <div class="class-progress-heading">
        <div><h2>Progression de la classe</h2><p>Moyenne de chaque dictée · échelle de 0 à 100 %</p></div>
      </div>
      <div
        v-if="!hasChartData"
        class="dictation-chart-empty class-chart-empty"
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
        <strong>Aucune moyenne disponible</strong>
        <span>La courbe apparaîtra dès que des résultats seront saisis.</span>
      </div>
      <div
        v-else
        class="dictation-chart-card class-dictation-chart"
      >
        <div class="dictation-chart-legend">
          <span><i class="class-average-legend" />Moyenne de la classe</span>
        </div>
        <div class="dictation-chart-scroll">
          <svg
            class="dictation-chart"
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            :style="{ minWidth: `${chartWidth}px` }"
            role="img"
            aria-label="Progression de la moyenne de classe en dictée, de 0 à 100 pour cent"
          >
            <g
              v-for="tick in chartTicks"
              :key="tick"
            >
              <line
                class="dictation-chart-grid"
                :x1="chartLeft"
                :y1="chartY(tick)"
                :x2="chartWidth - chartRight"
                :y2="chartY(tick)"
              />
              <text
                class="dictation-chart-y-label"
                :x="chartLeft - 8"
                :y="chartY(tick) + 3"
              >{{ tick }} %</text>
            </g>
            <polyline
              v-for="(segment, index) in chartSegments"
              :key="index"
              class="dictation-chart-line class-average-line"
              :points="segment.map((point) => `${point.x},${point.y}`).join(' ')"
            />
            <template
              v-for="point in chartPoints"
              :key="point.dictation.id"
            >
              <circle
                v-if="point.rate !== null"
                class="dictation-chart-point class-average-point"
                :cx="point.x"
                :cy="point.y"
                r="4.5"
              >
                <title>{{ point.dictation.name }} · moyenne {{ point.rate.toFixed(2) }} %</title>
              </circle>
              <text
                class="dictation-chart-x-label"
                :x="point.x"
                :y="chartTop + chartPlotHeight + 22"
                :transform="`rotate(-30 ${point.x} ${chartTop + chartPlotHeight + 22})`"
              >{{ shortChartLabel(point.dictation.name) }}</text>
            </template>
          </svg>
        </div>
      </div>
    </section>

    <section class="evaluation-grid-card dictation-card">
      <div class="grid-help">
        <strong>Résultats des dictées</strong>
        <span>{{ snapshot.totalStudentCount }} élèves</span>
        <span>{{ snapshot.dictations.length }} dictée{{ snapshot.dictations.length > 1 ? 's' : '' }}</span>
        <span>Cliquez sur une case pour saisir les erreurs</span>
      </div>
      <div
        v-if="snapshot.dictations.length"
        class="dictation-table-scroll"
      >
        <table class="dictation-table">
          <thead>
            <tr>
              <th class="dictation-student-column">
                Élève
              </th>
              <th
                v-for="dictation in snapshot.dictations"
                :key="dictation.id"
              >
                <div class="dictation-header">
                  <strong>{{ dictation.name }}</strong>
                  <small>N1 {{ dictation.wordCounts[0] }} · N2 {{ dictation.wordCounts[1] }} · N3 {{ dictation.wordCounts[2] }}</small>
                  <span>
                    <Button
                      unstyled
                      class="icon-button subtle"
                      title="Modifier"
                      aria-label="Modifier la dictée"
                      @click="emit('edit', dictation.id)"
                    >
                      <span class="icon"><svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      ><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg></span>
                    </Button>
                    <Button
                      unstyled
                      class="icon-button subtle danger"
                      title="Supprimer"
                      aria-label="Supprimer la dictée"
                      @click="emit('remove', dictation.id)"
                    >
                      <span class="icon"><svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      ><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></svg></span>
                    </Button>
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="student in snapshot.students"
              :key="student.id"
            >
              <th class="dictation-student-column">
                {{ student.firstName }}<small class="student-default-level">N{{ student.level }}</small>
              </th>
              <td
                v-for="dictation in snapshot.dictations"
                :key="dictation.id"
              >
                <button
                  type="button"
                  class="dictation-score"
                  :class="scoreClass(scoreFor(student.id, dictation.id))"
                  :title="scoreTitle(scoreFor(student.id, dictation.id))"
                  @click="emit('edit-result', student.id, dictation.id)"
                >
                  <span v-if="scoreFor(student.id, dictation.id)?.kind === 'absent'">ABS</span>
                  <span v-else-if="scoreFor(student.id, dictation.id)?.kind === 'rate'">{{ scoreFor(student.id, dictation.id)?.rate?.toFixed(2) }} %</span>
                  <span v-else>—</span>
                  <small>N{{ scoreFor(student.id, dictation.id)?.level }}</small>
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th class="dictation-student-column">
                Moyenne
              </th>
              <td
                v-for="dictation in snapshot.dictations"
                :key="dictation.id"
              >
                <span
                  class="dictation-average"
                  :class="dictation.average === null ? 'empty' : rateTone(dictation.average)"
                >{{ dictation.average === null ? '—' : `${dictation.average.toFixed(2)} %` }}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div
        v-else
        class="empty-state dictation-empty"
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
        <h3>Votre première dictée</h3>
        <p>Définissez les niveaux des élèves, puis ajoutez les trois nombres de mots.</p>
        <Button
          unstyled
          class="primary-button"
          @click="emit('create')"
        >
          <span class="icon"><svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          ><path d="M12 5v14M5 12h14" /></svg></span>
          Nouvelle dictée
        </Button>
      </div>
    </section>
  </main>
</template>
