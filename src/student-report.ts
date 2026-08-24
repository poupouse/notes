export interface StudentReportMetric {
  id: string;
  name: string;
  kind: 'group' | 'subgroup';
  rate: number | null;
  colorIndex: number;
  colored: boolean;
}

export interface StudentReportSubject {
  id: string;
  name: string;
  rate?: number | null;
  metrics: StudentReportMetric[];
}

export interface StudentReportDictation {
  id: string;
  name: string;
  level: number;
  result: number | null | 'absent';
}

export interface StudentReportPage {
  id: string;
  firstName: string;
  subjects: StudentReportSubject[];
  dictations?: StudentReportDictation[];
}

export interface StudentReportDocument {
  generatedAt: Date;
  students: StudentReportPage[];
}

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const rateLabel = (rate: number | null | undefined): string =>
  rate === null ? 'Non évalué' : rate === undefined ? '' : `${Math.round(rate * 100)} %`;

const pointOnCircle = (
  centerX: number,
  centerY: number,
  radius: number,
  index: number,
  count: number,
): [number, number] => {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, count);
  return [centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius];
};

const svgPoints = (points: Array<[number, number]>): string =>
  points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

const wrappedLabel = (value: string, maximumLength = 22): string[] => {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  words.forEach((word) => {
    const current = lines[lines.length - 1];
    if (!current || current.length + word.length + 1 > maximumLength) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
  });
  if (lines.length <= 2) return lines;
  return [lines[0], `${lines.slice(1).join(' ').slice(0, maximumLength - 1)}…`];
};

const radarChart = (metrics: StudentReportMetric[]): string => {
  const width = 720;
  const height = 205;
  const centerX = width / 2;
  const centerY = 100;
  const radius = 64;
  const count = metrics.length;
  const grid = [0.2, 0.4, 0.6, 0.8, 1].map((level) =>
    `<circle cx="${centerX}" cy="${centerY}" r="${radius * level}" class="radar-grid"/>`).join('');
  const axes = metrics.map((_, index) => {
    const [x, y] = pointOnCircle(centerX, centerY, radius, index, count);
    return `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" class="radar-axis"/>`;
  }).join('');
  const dataPoints = metrics.map((metric, index) => pointOnCircle(
    centerX,
    centerY,
    radius * (metric.rate ?? 0),
    index,
    count,
  ));
  const shape = count >= 3
    ? `<polygon points="${svgPoints(dataPoints)}" class="radar-result"/>`
    : count === 2
      ? `<polyline points="${svgPoints(dataPoints)}" class="radar-result-line"/>`
      : `<line x1="${centerX}" y1="${centerY}" x2="${dataPoints[0]?.[0] ?? centerX}" y2="${dataPoints[0]?.[1] ?? centerY}" class="radar-result-line"/>`;
  const points = dataPoints.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" class="radar-point"/>`).join('');
  const labels = metrics.map((metric, index) => {
    const [x, y] = pointOnCircle(centerX, centerY, radius + 24, index, count);
    const anchor = x < centerX - 25 ? 'end' : x > centerX + 25 ? 'start' : 'middle';
    const lines = wrappedLabel(metric.name).map((line, lineIndex) =>
      `<tspan x="${x}" dy="${lineIndex ? 13 : 0}">${escapeHtml(line)}</tspan>`).join('');
    const result = metric.rate === null ? 'Non évalué' : `${Math.round(metric.rate * 100)} %`;
    return `<text x="${x}" y="${y - 5}" text-anchor="${anchor}" class="radar-label">${lines}<tspan x="${x}" dy="15" class="radar-value">${result}</tspan></text>`;
  }).join('');
  const scaleLabels = [20, 40, 60, 80, 100].map((value) =>
    `<text x="${centerX + 4}" y="${centerY - radius * value / 100 + 10}" class="radar-scale">${value}</text>`).join('');
  return `<svg class="radar-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Diagramme en toile des résultats">${grid}${axes}${scaleLabels}${shape}${points}${labels}</svg>`;
};

const shortChartLabel = (value: string): string => value.length > 15 ? `${value.slice(0, 13)}…` : value;

const dictationChart = (dictations: StudentReportDictation[]): string => {
  const width = 720;
  const height = 215;
  const left = 52;
  const right = 24;
  const top = 18;
  const plotHeight = 125;
  const bottomY = top + plotHeight;
  const plotWidth = width - left - right;
  const xFor = (index: number): number => dictations.length <= 1
    ? left + plotWidth / 2
    : left + index * (plotWidth / (dictations.length - 1));
  const yFor = (value: number): number => top + ((100 - value) / 100) * plotHeight;
  const ticks = [0, 20, 40, 60, 80, 100].map((value) => {
    const y = yFor(value);
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="line-grid"/><text x="${left - 8}" y="${y + 4}" text-anchor="end" class="line-y-label">${value} %</text>`;
  }).join('');
  const numeric = dictations.map((dictation, index) => ({ dictation, index }))
    .filter((item): item is { dictation: StudentReportDictation & { result: number }; index: number } => typeof item.dictation.result === 'number');
  const segments: Array<typeof numeric> = [];
  numeric.forEach((item) => {
    const current = segments[segments.length - 1];
    if (!current || current[current.length - 1].index !== item.index - 1) segments.push([item]);
    else current.push(item);
  });
  const lines = segments.map((segment) => segment.length > 1
    ? `<polyline points="${segment.map(({ dictation, index }) => `${xFor(index)},${yFor(dictation.result)}`).join(' ')}" class="line-result"/>`
    : '').join('');
  const points = numeric.map(({ dictation, index }) =>
    `<circle cx="${xFor(index)}" cy="${yFor(dictation.result)}" r="4" class="line-point"/><text x="${xFor(index)}" y="${yFor(dictation.result) - 9}" text-anchor="middle" class="line-value">${Math.round(dictation.result)} %</text>`).join('');
  let trend = '';
  if (numeric.length >= 2) {
    const count = numeric.length;
    const sumX = numeric.reduce((sum, item) => sum + item.index, 0);
    const sumY = numeric.reduce((sum, item) => sum + item.dictation.result, 0);
    const sumXY = numeric.reduce((sum, item) => sum + item.index * item.dictation.result, 0);
    const sumXX = numeric.reduce((sum, item) => sum + item.index * item.index, 0);
    const denominator = count * sumXX - sumX * sumX;
    if (denominator) {
      const slope = (count * sumXY - sumX * sumY) / denominator;
      const intercept = (sumY - slope * sumX) / count;
      const clamp = (value: number): number => Math.max(0, Math.min(100, value));
      const lastIndex = Math.max(0, dictations.length - 1);
      trend = `<line x1="${xFor(0)}" y1="${yFor(clamp(intercept))}" x2="${xFor(lastIndex)}" y2="${yFor(clamp(intercept + slope * lastIndex))}" class="line-trend"/>`;
    }
  }
  const labelInterval = Math.max(1, Math.ceil(dictations.length / 10));
  const labels = dictations.map((dictation, index) => {
    const resultMarker = dictation.result === 'absent' ? 'A' : dictation.result === null ? 'NE' : '';
    const showLabel = index % labelInterval === 0 || index === dictations.length - 1;
    return `${resultMarker ? `<text x="${xFor(index)}" y="${bottomY - 7}" text-anchor="middle" class="line-missing">${resultMarker}</text>` : ''}${showLabel ? `<text x="${xFor(index)}" y="${bottomY + 22}" text-anchor="middle" class="line-x-label">${escapeHtml(shortChartLabel(dictation.name))}<tspan x="${xFor(index)}" dy="12">Niv. ${dictation.level}</tspan></text>` : ''}`;
  }).join('');
  return `<svg class="dictation-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Courbe de progression en dictée">${ticks}${trend}${lines}${points}${labels}</svg>`;
};

export const buildStudentReportHtml = (document: StudentReportDocument): string => {
  const generatedDate = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(document.generatedAt);
  const studentPages = document.students.map((student) => {
    const simpleSubjects = student.subjects.filter((subject) => !subject.metrics.length);
    const radarSubjects = student.subjects.filter((subject) => subject.metrics.length);
    const subjects = `${simpleSubjects.length ? `
      <section class="subject-summary">
        <header class="section-title subject-summary-title"><div><small>Matières</small><h2>Résultats par matière</h2></div></header>
        <div class="subject-summary-list">${simpleSubjects.map((subject) => `<div><span>${escapeHtml(subject.name)}</span><strong>${rateLabel(subject.rate)}</strong></div>`).join('')}</div>
      </section>` : ''}${radarSubjects.map((subject) => `
      <section class="radar-block">
        <header class="radar-header"><div><small>Matière - groupes et sous-groupes</small><h2>${escapeHtml(subject.name)}</h2></div>${subject.rate === undefined ? '' : `<strong>${rateLabel(subject.rate)}</strong>`}</header>
        ${radarChart(subject.metrics)}
      </section>`).join('')}`;
    const dictations = student.dictations ? `
      <section class="dictations-block">
        <header class="section-title"><div><small>Dictées</small><h2>Courbe de progression</h2></div><div class="chart-heading-meta"><strong>${escapeHtml(student.firstName)}</strong><div class="chart-legend"><span>Résultats</span><span>Tendance</span></div></div></header>
        ${student.dictations.length ? dictationChart(student.dictations) : '<p class="empty-chart">Aucun résultat de dictée.</p>'}
      </section>` : '';
    return `
      <article class="student-page">
        <header class="report-header">
          <div><p>SUIVI RÉGULIER</p><h1>Synthèse des résultats</h1></div>
          <div class="student-name"><small>Élève</small><strong>${escapeHtml(student.firstName)}</strong></div>
        </header>
        <p class="report-date">Situation au ${escapeHtml(generatedDate)}</p>
        <main>${subjects}${dictations}</main>
        <footer>Document de suivi destiné à la famille - Carnet</footer>
      </article>`;
  }).join('');

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Synthèse des résultats</title><style>
    @page{size:A4;margin:8mm 10mm 10mm}*{box-sizing:border-box}body{margin:0;color:#303832;background:#fff;font-family:Arial,sans-serif;font-size:9pt}
    .student-page{min-height:275mm;display:flex;flex-direction:column;page-break-after:always}.student-page:last-child{page-break-after:auto}
    .report-header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:0 0 4mm;border-bottom:1.5px solid #41695a}.report-header p{margin:0 0 1.5mm;color:#c2754b;font-size:6.5pt;font-weight:700;letter-spacing:1.2px}.report-header h1{margin:0;color:#243d34;font-size:20pt;line-height:1}.student-name{min-width:42mm;padding:2.2mm 4mm;background:#f1f6f3;border-radius:2.5mm;text-align:right}.student-name small,.section-title small,.subject-header small{display:block;margin-bottom:.5mm;color:#768079;font-size:6pt;font-weight:700;letter-spacing:.7px;text-transform:uppercase}.student-name strong{font-size:13pt;color:#294d40}.report-date{margin:2mm 0 3mm;color:#7b827d;font-size:7pt}
    main{display:grid;gap:2.5mm}.subject-summary,.radar-block,.dictations-block{overflow:hidden;border:1px solid #d8ddd9;border-radius:2.5mm;break-inside:avoid}.section-title,.radar-header{display:flex;align-items:center;justify-content:space-between;min-height:10.5mm;padding:1.5mm 4mm;background:#f2f6f3;border-top:1mm solid #41695a}.section-title h2,.radar-header h2{margin:0;color:#294d40;font-size:11.5pt}.radar-header small{display:block;margin-bottom:.5mm;color:#768079;font-size:6pt;font-weight:700;letter-spacing:.7px;text-transform:uppercase}.radar-header>strong{color:#294d40;font-size:13pt}.subject-summary-list{display:grid}.subject-summary-list>div{display:flex;align-items:center;justify-content:space-between;min-height:11mm;padding:2mm 5mm;border-top:1px solid #e1e3df;font-size:10pt}.subject-summary-list strong{color:#294d40;font-size:13pt}.radar-chart{display:block;width:100%;height:auto;background:#fff}.radar-grid{fill:none;stroke:#dce3df;stroke-width:1}.radar-axis{stroke:#cdd7d2;stroke-width:1}.radar-scale{fill:#a0aaa4;font-size:7px}.radar-result{fill:rgba(65,105,90,.24);stroke:#41695a;stroke-width:3;stroke-linejoin:round}.radar-result-line{fill:none;stroke:#41695a;stroke-width:4;stroke-linecap:round}.radar-point{fill:#fff;stroke:#d47a49;stroke-width:3}.radar-label{fill:#46514b;font-size:10px;font-weight:650}.radar-value{fill:#41695a;font-size:11px;font-weight:800}
    .section-title{border-top-color:#c2754b;background:#fdf8f4}.section-title h2{color:#684b3a}.subject-summary-title{border-top-color:#41695a;background:#f2f6f3}.subject-summary-title h2{color:#294d40}.chart-heading-meta{display:grid;gap:1mm;justify-items:end}.chart-heading-meta>strong{color:#684b3a;font-size:8pt}.chart-legend{display:flex;gap:4mm;color:#6e756f;font-size:6pt}.chart-legend span:before{content:"";display:inline-block;width:7mm;margin-right:1mm;border-top:1.5px solid #d47a49;vertical-align:middle}.chart-legend span:last-child:before{border-color:#41695a;border-top-style:dashed}.dictation-chart{display:block;width:100%;height:auto;background:#fff}.line-grid{stroke:#e0e5e2;stroke-width:1}.line-y-label,.line-x-label{fill:#77817b;font-size:8px}.line-result{fill:none;stroke:#d47a49;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.line-point{fill:#fff;stroke:#d47a49;stroke-width:3}.line-value{fill:#9a5430;font-size:8px;font-weight:700}.line-trend{stroke:#41695a;stroke-width:2;stroke-dasharray:7 5}.line-missing{fill:#8b918c;font-size:8px;font-weight:800}.empty-chart{padding:7mm;color:#7c837e;text-align:center}
    footer{margin-top:auto;padding-top:2mm;color:#8b918c;border-top:1px solid #e1e3df;font-size:6pt;text-align:center}
  </style></head><body>${studentPages}</body></html>`;
};
