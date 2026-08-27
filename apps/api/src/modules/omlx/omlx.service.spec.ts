import { OmlxService } from './omlx.service';

describe('OmlxService JSON parser', () => {
  const service = new OmlxService({} as never);

  it('accepts fenced JSON returned by a local model', () => {
    expect(service.parseJson('```json\n{"answer":"ok"}\n```')).toEqual({ answer: 'ok' });
  });

  it('extracts the first complete object from surrounding text', () => {
    expect(service.parseJson('result follows: {"value": 7} done')).toEqual({ value: 7 });
  });
});
