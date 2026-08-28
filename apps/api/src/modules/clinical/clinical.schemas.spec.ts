import { sourceSchema } from './clinical.schemas';

describe('sourceSchema', () => {
  it('rejects a treating doctor order that is not patient specific', () => {
    const result = sourceSchema.safeParse({
      sourceType: 'TREATING_DOCTOR_ORDER',
      title: '复诊医嘱',
      isPatientSpecific: false
    });
    expect(result.success).toBe(false);
  });

  it('keeps online education as a valid but non-patient-specific source', () => {
    const result = sourceSchema.safeParse({
      sourceType: 'ONLINE_EDUCATION',
      title: '公开视频科普',
      platform: '视频平台',
      isPatientSpecific: false
    });
    expect(result.success).toBe(true);
  });

  it('accepts an offline treating-doctor visit without a duplicated quote', () => {
    const result = sourceSchema.safeParse({
      sourceType: 'TREATING_DOCTOR_ORDER',
      title: '2026-08-29 心内科门诊',
      authorName: '测试医生',
      organization: '测试医院',
      specialty: '心内科',
      publishedAt: '2026-08-29T09:00:00+08:00',
      isPatientSpecific: true
    });
    expect(result.success).toBe(true);
  });
});
