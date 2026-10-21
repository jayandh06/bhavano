import { AuthService } from './auth.service';

// Their JWKS client is ESM-only, which this Jest setup can't load; OTP sending never uses them.
jest.mock('./providers/apple.provider', () => ({ AppleProvider: class {} }));
jest.mock('./providers/google.provider', () => ({ GoogleProvider: class {} }));

function makeService(env: Record<string, string> = {}, whatsappOk = true) {
  const config = { get: jest.fn((key: string) => env[key]) };
  const otpService = { createChallenge: jest.fn().mockResolvedValue('123456') };
  const msg91 = {
    sendWhatsappOtp: jest.fn().mockResolvedValue(whatsappOk),
    sendOtp: jest.fn().mockResolvedValue(undefined),
  };
  const noop = {} as never;
  const service = new AuthService(
    {} as never,
    config as never,
    otpService as never,
    msg91 as never,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
  );
  return { service, msg91, otpService };
}

describe('AuthService.sendOtp — WhatsApp first, SMS as the fallback', () => {
  it('sends on WhatsApp by default and does not also send an SMS', async () => {
    const { service, msg91 } = makeService();
    await expect(service.sendOtp('9876543210')).resolves.toBe('whatsapp');
    expect(msg91.sendWhatsappOtp).toHaveBeenCalledWith('9876543210', '123456');
    expect(msg91.sendOtp).not.toHaveBeenCalled();
  });

  it('falls back to SMS with the same code when WhatsApp does not take it', async () => {
    const { service, msg91 } = makeService({}, false);
    await expect(service.sendOtp('9876543210')).resolves.toBe('sms');
    expect(msg91.sendOtp).toHaveBeenCalledWith('9876543210', '123456');
  });

  it('goes straight to SMS when the caller asks for it', async () => {
    const { service, msg91 } = makeService();
    await expect(service.sendOtp('9876543210', 'sms')).resolves.toBe('sms');
    expect(msg91.sendWhatsappOtp).not.toHaveBeenCalled();
    expect(msg91.sendOtp).toHaveBeenCalledTimes(1);
  });

  it('OTP_DEFAULT_CHANNEL=sms is a kill switch for the WhatsApp attempt', async () => {
    const { service, msg91 } = makeService({ OTP_DEFAULT_CHANNEL: 'sms' });
    await expect(service.sendOtp('9876543210')).resolves.toBe('sms');
    expect(msg91.sendWhatsappOtp).not.toHaveBeenCalled();
  });

  it('the App Review test account sends nothing', async () => {
    const { service, msg91 } = makeService({ TEST_OTP_PHONE: '9000000000', TEST_OTP_CODE: '111111' });
    await service.sendOtp('9000000000');
    expect(msg91.sendWhatsappOtp).not.toHaveBeenCalled();
    expect(msg91.sendOtp).not.toHaveBeenCalled();
  });
});
