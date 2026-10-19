import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NotificationLogQueryDto } from './notification-log-query.dto';

async function errorsFor(channel: string) {
  return validate(plainToInstance(NotificationLogQueryDto, { channel }));
}

describe('NotificationLogQueryDto channel', () => {
  // The admin page's Channel filter offers every one of these; a value the DTO refuses makes the
  // whole page fail with a 400 (this happened for in_app).
  it.each(['email', 'whatsapp', 'push', 'in_app'])('accepts %s', async (channel) => {
    expect(await errorsFor(channel)).toHaveLength(0);
  });

  it('still refuses an unknown channel', async () => {
    expect(await errorsFor('carrier-pigeon')).not.toHaveLength(0);
  });
});
