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

  it('capitalises a name typed entirely in lowercase, and leaves a mixed-case name alone', () => {
    expect(cleanAreaName('kurasi road')).toBe('Kurasi Road');
    expect(cleanAreaName("raju's colony")).toBe("Raju's Colony");
    expect(cleanAreaName('HSR Layout')).toBe('HSR Layout');
    expect(cleanAreaName('K P H B Phase 1')).toBe('K P H B Phase 1');
  });

  it('refuses a link and directions', () => {
    expect(() => cleanAreaName('https://maps.app.goo.gl/91zcDPiV53FdMejy9')).toThrow(BadRequestException);
    expect(() => cleanAreaName('Near Pani Tanki More (Clock Tower)')).toThrow(BadRequestException);
    expect(() => cleanAreaName('Opposite City Mall')).toThrow(BadRequestException);
    expect(cleanAreaName('Nearby Colony')).toBe('Nearby Colony');
  });
});
