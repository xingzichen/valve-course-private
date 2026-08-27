import { AiService } from './ai.service';

describe('AiService deterministic safety gate', () => {
  it('does not enqueue a model job when an urgent symptom is reported', async () => {
    const repository = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown) =>
        Promise.resolve({ id: 'analysis-id', ...(value as object) })
      )
    };
    const queue = { add: jest.fn() };
    const config = { get: jest.fn(() => 'Qwen3.8-27B-6bit') };
    const service = new AiService(repository as never, queue as never, config as never);

    const result = await service.create({
      analysisType: 'GENERAL_QUESTION',
      question: '现在应该怎么办？',
      urgentSymptoms: {
        chestPain: true,
        syncope: false,
        severeDyspnea: false,
        strokeSigns: false,
        majorBleeding: false,
        persistentFastHeartRate: false
      }
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.modelId).toBe('DETERMINISTIC_SAFETY_RULES');
    expect(result.answer).toContain('120');
    expect(queue.add).not.toHaveBeenCalled();
  });
});
