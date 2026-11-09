// Minimal structural view of a Lighthouse result (LHR).
// Core logic depends on this shape, not on Lighthouse's own types, so it stays
// testable against plain JSON fixtures and tolerant of minor LHR changes.

export interface LhrAudit {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  scoreDisplayMode: string;
  numericValue?: number;
  numericUnit?: string;
  displayValue?: string;
  metricSavings?: Record<string, number | undefined>;
  details?: {
    type?: string;
    items?: unknown[];
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
    [key: string]: unknown;
  };
}

export interface LhrAuditRef {
  id: string;
  weight: number;
  group?: string;
  acronym?: string;
}

export interface Lhr {
  lighthouseVersion: string;
  requestedUrl?: string;
  finalUrl?: string;
  finalDisplayedUrl?: string;
  fetchTime: string;
  runWarnings?: string[];
  runtimeError?: { code: string; message: string };
  configSettings: { formFactor?: string };
  audits: Record<string, LhrAudit>;
  categories: {
    performance?: {
      score: number | null;
      auditRefs: LhrAuditRef[];
    };
  };
}
