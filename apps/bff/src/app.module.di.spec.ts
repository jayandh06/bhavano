import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

/** Catches dependency-resolution errors that only surface at runtime — a missing module import
 * compiles fine and then crash-loops the container on boot. compile() resolves the whole graph
 * without calling onModuleInit, so it needs no database. */
// jwks-rsa pulls in `jose`, which ships ES modules only, and Jest cannot parse those. This test only
// builds the module graph and never verifies a token, so the real client is not needed.
jest.mock('jwks-rsa', () => ({ __esModule: true, default: jest.fn(() => ({ getSigningKey: jest.fn() })) }));

describe('AppModule dependency graph', () => {
  it('resolves every provider', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(moduleRef).toBeDefined();
  }, 30_000);
});
