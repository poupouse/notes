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

const dictationLabel = (result: number | null | 'absent'): string => {
  if (result === 'absent') return 'Absent';
  if (result === null) return 'Non évalué';
  return `${Math.round(result)} %`;
};

export const buildStudentReportHtml = (document: StudentReportDocument): string => {
  const generatedDate = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(document.generatedAt);
  const studentPages = document.students.map((student) => {
    const subjects = student.subjects.map((subject) => {
      const subjectRate = subject.rate === undefined ? '' : `<strong>${rateLabel(subject.rate)}</strong>`;
      const metrics = subject.metrics.map((metric) => `
        <div class="metric ${metric.colored ? `color-${metric.colorIndex}` : 'plain'}">
          <div><small>${metric.kind === 'group' ? 'Groupe' : 'Sous-groupe'}</small><span>${escapeHtml(metric.name)}</span></div>
          <strong>${rateLabel(metric.rate)}</strong>
        </div>`).join('');
      return `
        <section class="subject-block">
          <header class="subject-header"><div><small>Matière</small><h2>${escapeHtml(subject.name)}</h2></div>${subjectRate}</header>
          ${metrics ? `<div class="metrics">${metrics}</div>` : ''}
        </section>`;
    }).join('');
    const dictations = student.dictations ? `
      <section class="dictations-block">
        <header class="section-title"><div><small>Dictée</small><h2>Résultats de dictée</h2></div></header>
        <table><thead><tr><th>Dictée</th><th>Niveau</th><th>Résultat</th></tr></thead><tbody>
          ${student.dictations.map((dictation) => `<tr><td>${escapeHtml(dictation.name)}</td><td>Niveau ${dictation.level}</td><td><strong>${dictationLabel(dictation.result)}</strong></td></tr>`).join('')}
        </tbody></table>
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
    @page{size:A4;margin:12mm 13mm 14mm}*{box-sizing:border-box}body{margin:0;color:#303832;background:#fff;font-family:Arial,sans-serif;font-size:10pt}
    .student-page{min-height:270mm;display:flex;flex-direction:column;page-break-after:always}.student-page:last-child{page-break-after:auto}
    .report-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:0 0 9mm;border-bottom:2px solid #41695a}.report-header p{margin:0 0 3mm;color:#c2754b;font-size:8pt;font-weight:700;letter-spacing:1.4px}.report-header h1{margin:0;color:#243d34;font-size:25pt;line-height:1}.student-name{min-width:55mm;padding:4mm 5mm;background:#f1f6f3;border-radius:3mm;text-align:right}.student-name small,.section-title small,.subject-header small{display:block;margin-bottom:1mm;color:#768079;font-size:7pt;font-weight:700;letter-spacing:.8px;text-transform:uppercase}.student-name strong{font-size:16pt;color:#294d40}.report-date{margin:4mm 0 6mm;color:#7b827d;font-size:8.5pt}
    main{display:grid;gap:5mm}.subject-block,.dictations-block{overflow:hidden;border:1px solid #d8ddd9;border-radius:3mm;break-inside:avoid}.subject-header,.section-title{display:flex;align-items:center;justify-content:space-between;min-height:16mm;padding:3mm 5mm;background:#f2f6f3;border-top:1.5mm solid #41695a}.subject-header h2,.section-title h2{margin:0;color:#294d40;font-size:14pt}.subject-header>strong{font-size:16pt;color:#294d40}.metrics{display:grid;grid-template-columns:1fr 1fr}.metric{min-height:15mm;display:flex;align-items:center;justify-content:space-between;gap:5mm;padding:3mm 4mm;border-top:1px solid var(--border,#d8ddd9);border-right:1px solid var(--border,#d8ddd9);background:var(--bg,#fff);color:var(--ink,#3e4641)}.metric:nth-child(even){border-right:0}.metric small{display:block;margin-bottom:1mm;font-size:6.5pt;font-weight:700;letter-spacing:.5px;text-transform:uppercase;opacity:.72}.metric span{font-size:9.5pt}.metric strong{white-space:nowrap;font-size:11pt}.plain{--bg:#fff;--ink:#3e4641;--border:#d8ddd9}
    .color-0{--bg:#e7f2ed;--ink:#285d49;--border:#bdd8cb}.color-1{--bg:#f8edda;--ink:#80571a;--border:#ead0a3}.color-2{--bg:#e9eef8;--ink:#425f91;--border:#c8d3e9}.color-3{--bg:#f5e8ed;--ink:#8a4b64;--border:#e5c5d1}.color-4{--bg:#eee9f7;--ink:#67518e;--border:#d5c9e9}.color-5{--bg:#e5f2f3;--ink:#346a6e;--border:#bedcdf}.color-6{--bg:#f2eddf;--ink:#74612d;--border:#ded2ad}.color-7{--bg:#eaf1e2;--ink:#526d37;--border:#cbdcba}
    .section-title{border-top-color:#c2754b;background:#fdf8f4}.section-title h2{color:#684b3a}table{width:100%;border-collapse:collapse}th,td{padding:3mm 4mm;border-top:1px solid #e1e3df;text-align:left}th{color:#747c76;background:#fafaf8;font-size:7pt;text-transform:uppercase;letter-spacing:.5px}td:last-child,th:last-child{text-align:right}
    footer{margin-top:auto;padding-top:6mm;color:#8b918c;border-top:1px solid #e1e3df;font-size:7pt;text-align:center}
  </style></head><body>${studentPages}</body></html>`;
};
