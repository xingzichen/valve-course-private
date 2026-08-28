import { analysisResponseSchema } from './ai-response';

describe('AI analysis response parser', () => {
  it('accepts reference-only evidence returned by the local model', () => {
    const response = analysisResponseSchema.parse({
      answer: '复诊时可优先确认症状变化。',
      evidence: [{ ref: 'REF:PROFILE' }, { ref: 'REF:TIMELINE:event-id' }]
    });

    expect(response.evidence).toEqual([
      { ref: 'REF:PROFILE', statement: '', sourceType: '档案上下文' },
      { ref: 'REF:TIMELINE:event-id', statement: '', sourceType: '档案上下文' }
    ]);
  });

  it('preserves complete evidence metadata', () => {
    const response = analysisResponseSchema.parse({
      answer: '回答',
      evidence: [
        {
          ref: 'REF:ORDER:order-id',
          statement: '经治医生建议复查。',
          sourceType: '经治医生医嘱'
        }
      ],
      uncertainties: [],
      questionsForDoctor: [],
      urgentWarning: null
    });

    expect(response.evidence[0]).toEqual({
      ref: 'REF:ORDER:order-id',
      statement: '经治医生建议复查。',
      sourceType: '经治医生医嘱'
    });
  });

  it('still rejects evidence without a reference identifier', () => {
    expect(() =>
      analysisResponseSchema.parse({ answer: '回答', evidence: [{ statement: '无来源的陈述' }] })
    ).toThrow();
  });
});
