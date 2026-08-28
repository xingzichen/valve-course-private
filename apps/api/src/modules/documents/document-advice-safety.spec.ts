import type { DocumentAdvice, DocumentExtraction } from '@valve/contracts';

import { sanitizeDocumentAdvice } from './document-advice-safety';

const extraction: DocumentExtraction = {
  documentType: 'LAB_REPORT',
  title: 'NT-proBNP 检验报告',
  summary: 'NT-proBNP 94.85 pg/ml',
  documentedAt: null,
  datePrecision: 'UNKNOWN',
  facility: null,
  department: null,
  facts: [
    {
      fieldKey: 'nt_probnp',
      label: 'NT-proBNP',
      valueText: '94.85',
      valueNumeric: 94.85,
      unit: 'pg/ml',
      referenceRange: '<300',
      abnormalFlag: 'NORMAL',
      factKind: 'MEASUREMENT',
      pageNumber: 1,
      originalText: 'NT-proBNP 94.85pg/ml 正常<300pg/ml',
      confidence: 1,
      highRisk: false
    }
  ],
  warnings: []
};

const advice: DocumentAdvice = {
  overview: '该项正常，与目前状况相符。',
  keyFindings: [
    {
      label: '结果正常',
      explanation: '有助于排除急性心力衰竭。',
      evidenceFieldKeys: ['nt_probnp']
    }
  ],
  followUpActions: ['结合症状和超声复诊。'],
  questionsForDoctor: ['这是否支持继续观察而不启动华法林或利伐沙班？'],
  urgentWarning: null,
  limitations: ['尚未人工核对。']
};

describe('sanitizeDocumentAdvice', () => {
  it('blocks unrelated anticoagulation advice and overconfident conclusions', () => {
    const result = sanitizeDocumentAdvice(extraction, advice);

    expect(result.overview).toBe(advice.overview);
    expect(result.keyFindings).toEqual([]);
    expect(result.followUpActions).toEqual(advice.followUpActions);
    expect(result.questionsForDoctor).toEqual([
      '这份报告最需要结合哪些症状、既往趋势或其他检查一起解读？'
    ]);
    expect(result.limitations).toContain(
      '识别结果尚未人工核对；单项报告不能独立决定诊断、用药或随访方案。'
    );
  });
});
