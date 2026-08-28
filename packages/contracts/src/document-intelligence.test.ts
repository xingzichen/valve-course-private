import { describe, expect, it } from 'vitest';

import { documentExtractionSchema } from './index';

describe('documentExtractionSchema', () => {
  it('normalizes numeric strings and percentage confidence from local models', () => {
    const parsed = documentExtractionSchema.parse({
      documentType: 'LAB_REPORT',
      title: '血常规',
      summary: '检验报告',
      documentedAt: '2026-08-26T09:23:00+08:00',
      datePrecision: 'DATETIME',
      facility: '示例医院',
      department: '检验科',
      facts: [
        {
          fieldKey: 'wbc',
          label: '白细胞',
          valueText: 6.69,
          valueNumeric: '6.69',
          unit: '10^9/L',
          referenceRange: '3.50–9.50',
          abnormalFlag: 'NORMAL',
          factKind: 'MEASUREMENT',
          pageNumber: '1',
          confidence: '96',
          highRisk: false
        }
      ],
      warnings: []
    });

    expect(parsed.facts[0]).toMatchObject({
      valueText: '6.69',
      valueNumeric: 6.69,
      pageNumber: 1,
      confidence: 0.96
    });
  });
});
