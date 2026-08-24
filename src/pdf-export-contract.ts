export const PDF_EXPORT_CHANNELS = {
  studentReport: 'pdf:export-student-report',
} as const;

export interface PdfExportRequest {
  html: string;
  defaultFileName: string;
}

export interface PdfExportResult {
  status: 'saved' | 'cancelled';
  filePath?: string;
}

export interface PdfExportApi {
  exportStudentReport(request: PdfExportRequest): Promise<PdfExportResult>;
}

declare global {
  interface Window {
    pdfExport: PdfExportApi;
  }
}
