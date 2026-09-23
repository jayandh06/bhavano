import type { PinoLogger } from 'nestjs-pino';
import { logClientError } from './clientErrorLogger';

describe('logClientError', () => {
  it('logs at error level with the message as the second (pino) argument', () => {
    const errorFn = jest.fn();
    const infoFn = jest.fn();
    const logger = { error: errorFn, info: infoFn } as unknown as PinoLogger;

    logClientError({ logger, app: 'web', message: 'boom' });

    expect(errorFn).toHaveBeenCalledWith(
      expect.objectContaining({ app: 'web', message: 'boom' }),
      'client_error',
    );
    expect(infoFn).not.toHaveBeenCalled();
  });

  it('never includes the logger instance itself in the logged fields', () => {
    const errorFn = jest.fn();
    const logger = {
      error: errorFn,
      info: jest.fn(),
    } as unknown as PinoLogger;

    logClientError({ logger, app: 'mobile', message: 'boom', userId: 'u1' });

    const [fields] = errorFn.mock.calls[0] as [Record<string, unknown>, string];
    expect(fields).not.toHaveProperty('logger');
    expect(fields).toEqual({
      app: 'mobile',
      message: 'boom',
      stack: undefined,
      componentStack: undefined,
      url: undefined,
      digest: undefined,
      userAgent: undefined,
      appVersion: undefined,
      userId: 'u1',
      ip: undefined,
    });
  });
});
