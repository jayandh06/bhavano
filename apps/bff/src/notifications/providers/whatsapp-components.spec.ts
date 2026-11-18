import { toMetaComponents } from './whatsapp-components';

describe('toMetaComponents', () => {
  it('maps the OTP shape: positional body 1 and the copy-code button (index 0)', () => {
    expect(
      toMetaComponents({
        body_1: { type: 'text', value: '123456' },
        button_1: { subtype: 'url', type: 'text', value: '123456' },
      }),
    ).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: '123456' }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '123456' }] },
    ]);
  });

  it('maps named body variables with their parameter_name', () => {
    expect(
      toMetaComponents({
        body_name: { type: 'text', value: 'Ravi', parameter_name: 'name' },
        body_title: { type: 'text', value: '2 BHK', parameter_name: 'title' },
        button_1: { subtype: 'url', type: 'text', value: 'abc' },
      }),
    ).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Ravi', parameter_name: 'name' },
          { type: 'text', text: '2 BHK', parameter_name: 'title' },
        ],
      },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'abc' }] },
    ]);
  });

  it('orders positional variables by number and emits one component per dynamic button', () => {
    const out = toMetaComponents({
      body_3: { type: 'text', value: 'c' },
      body_1: { type: 'text', value: 'a' },
      body_2: { type: 'text', value: 'b' },
      button_2: { subtype: 'url', type: 'text', value: 's2' },
      button_1: { subtype: 'url', type: 'text', value: 's1' },
    });
    expect(out[0]).toEqual({
      type: 'body',
      parameters: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }, { type: 'text', text: 'c' }],
    });
    expect(out.slice(1)).toEqual([
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 's1' }] },
      { type: 'button', sub_type: 'url', index: '1', parameters: [{ type: 'text', text: 's2' }] },
    ]);
  });

  it('turns a missing value into an empty string and an empty input into no components', () => {
    expect(toMetaComponents({ body_1: { type: 'text' } })).toEqual([{ type: 'body', parameters: [{ type: 'text', text: '' }] }]);
    expect(toMetaComponents(undefined)).toEqual([]);
    expect(toMetaComponents({})).toEqual([]);
  });
});
