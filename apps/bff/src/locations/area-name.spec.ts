import { BadRequestException } from '@nestjs/common';
import { cleanAreaName } from './area-name';

describe('cleanAreaName', () => {
  it('leaves an ordinary locality alone', () => {
    expect(cleanAreaName('HSR Layout')).toBe('HSR Layout');
    expect(cleanAreaName('Sri Ramnagar - Block B')).toBe('Sri Ramnagar - Block B');
  });

  it('collapses repeated whitespace', () => {
    expect(cleanAreaName('  Indira   Nagar  II Stage ')).toBe('Indira Nagar II Stage');
  });

  it('keeps a comma that is part of the name, and drops a dangling one', () => {
    expect(cleanAreaName('Sector 30, Kharghar')).toBe('Sector 30, Kharghar');
    expect(cleanAreaName('Kunjera, 281504')).toBe('Kunjera');
  });

  it('removes a pin code and its label', () => {
    expect(cleanAreaName('Govardhan Chatta Road  Pin  281504')).toBe('Govardhan Chatta Road');
    expect(cleanAreaName('Kunjera 281504')).toBe('Kunjera');
  });

  it('refuses an empty name and a full address', () => {
    expect(() => cleanAreaName('   ')).toThrow(BadRequestException);
    expect(() => cleanAreaName('Shiv vihar gali no.1 gumaniwala shyampur near the old railway crossing Rishikesh')).toThrow(
      BadRequestException,
    );
  });
});
