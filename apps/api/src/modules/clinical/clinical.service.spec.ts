import { ClinicalService } from './clinical.service';

function createService(sourceRepository: Record<string, jest.Mock>, orderRepository = {}) {
  const dataSource = {
    transaction: jest.fn((work: (manager: unknown) => unknown) =>
      Promise.resolve(work({ getRepository: () => orderRepository }))
    )
  };
  return new ClinicalService(
    {} as never,
    sourceRepository as never,
    {} as never,
    orderRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    dataSource as never
  );
}

describe('ClinicalService source/order consistency', () => {
  it('normalizes treating-doctor sources as offline visit context without a quote', async () => {
    const sourceRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value))
    };
    const service = createService(sourceRepository);

    await service.createSource({
      sourceType: 'TREATING_DOCTOR_ORDER',
      title: '心内科门诊',
      platform: '其他平台',
      url: 'https://example.com',
      isPatientSpecific: true,
      originalQuote: '不应在来源中重复保存的医生原话',
      metadata: { createdFrom: 'test' }
    });

    expect(sourceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: '线下就医',
        url: null,
        isPatientSpecific: true,
        originalQuote: null,
        metadata: { createdFrom: 'test', channel: 'OFFLINE' }
      })
    );
  });

  it('copies visit context from the source instead of accepting duplicated order fields', async () => {
    const publishedAt = new Date('2026-08-29T09:00:00+08:00');
    const sourceRepository = {
      findOne: jest.fn(() =>
        Promise.resolve({
          id: 'source-id',
          sourceType: 'TREATING_DOCTOR_ORDER',
          isPatientSpecific: true,
          authorName: '来源医生',
          organization: '来源医院',
          specialty: '心内科',
          publishedAt
        })
      )
    };
    const orderRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value))
    };
    const service = createService(sourceRepository, orderRepository);

    await service.createOrder({
      sourceId: 'source-id',
      orderedAt: '2026-08-30T10:00:00+08:00',
      doctorName: '重复填写的医生',
      hospital: '重复填写的医院',
      department: '重复填写的科室',
      originalText: '医生原话',
      options: []
    });

    expect(orderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderedAt: publishedAt,
        doctorName: '来源医生',
        hospital: '来源医院',
        department: '心内科'
      })
    );
  });
});
