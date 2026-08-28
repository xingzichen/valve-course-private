import { OmlxService } from './omlx.service';

describe('OmlxService JSON parser', () => {
  const service = new OmlxService({} as never);

  it('accepts fenced JSON returned by a local model', () => {
    expect(service.parseJson('```json\n{"answer":"ok"}\n```')).toEqual({ answer: 'ok' });
  });

  it('extracts the first complete object from surrounding text', () => {
    expect(service.parseJson('result follows: {"value": 7} done')).toEqual({ value: 7 });
  });

  it('repairs common local-model JSON defects', () => {
    expect(service.parseJson('```json\n{"facts":[{"value":"ok",}],}\n```')).toEqual({
      facts: [{ value: 'ok' }]
    });
  });

  it('ignores a second object after the first complete response', () => {
    expect(service.parseJson('{"value":1}\n{"explanation":"extra"}')).toEqual({ value: 1 });
  });
});
