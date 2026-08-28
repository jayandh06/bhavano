import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

/** Catches dependency-resolution errors that only surface at runtime — a missing module import
 * compiles fine and then crash-loops the container on boot. compile() resolves the whole graph
 * without calling onModuleInit, so it needs no database. */
describe('AppModule dependency graph', () => {
  it('resolves every provider', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(moduleRef).toBeDefined();
  }, 30_000);
});
