import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LISTING_COPY_LLM_PROVIDER, resolveListingCopyProvider } from './providers/listing-copy-llm.provider';
import { NEARBY_LANDMARKS_PROVIDER } from './providers/nearby-landmarks.provider';
import { OpenAiListingCopyProvider } from './providers/openai-listing-copy.provider';
import { GeminiListingCopyProvider } from './providers/gemini-listing-copy.provider';
import { StubListingCopyProvider } from './providers/stub-listing-copy.provider';
import { GooglePlacesNearbyLandmarksProvider } from './providers/google-places-landmarks.provider';
import { StubLandmarksProvider } from './providers/stub-landmarks.provider';

/** Real providers need a live OPENAI_API_KEY/GEMINI_API_KEY / GOOGLE_MAPS_SERVER_KEY — this is
 * an assist feature, not core functionality, so a missing key (or NODE_ENV === 'test') falls
 * back to a deterministic stub instead of the usual "throw ServiceUnavailableException"
 * convention, keeping local dev/CI fully runnable with no live keys. See
 * docs/plans/ai-listing-copy-assist.md. */
@Module({
  imports: [RateLimitModule],
  controllers: [AiController],
  providers: [
    AiService,
    OpenAiListingCopyProvider,
    GeminiListingCopyProvider,
    StubListingCopyProvider,
    GooglePlacesNearbyLandmarksProvider,
    StubLandmarksProvider,
    {
      provide: LISTING_COPY_LLM_PROVIDER,
      useFactory: (
        config: ConfigService,
        openai: OpenAiListingCopyProvider,
        gemini: GeminiListingCopyProvider,
        stub: StubListingCopyProvider,
      ) => {
        const choice = resolveListingCopyProvider({
          providerOverride: config.get<string>('AI_LISTING_COPY_PROVIDER'),
          openaiConfigured: Boolean(config.get<string>('OPENAI_API_KEY')),
          geminiConfigured: Boolean(config.get<string>('GEMINI_API_KEY')),
          isTestEnv: process.env.NODE_ENV === 'test',
        });
        return { stub, openai, gemini }[choice];
      },
      inject: [ConfigService, OpenAiListingCopyProvider, GeminiListingCopyProvider, StubListingCopyProvider],
    },
    {
      provide: NEARBY_LANDMARKS_PROVIDER,
      useFactory: (config: ConfigService, real: GooglePlacesNearbyLandmarksProvider, stub: StubLandmarksProvider) =>
        config.get<string>('GOOGLE_MAPS_SERVER_KEY') && process.env.NODE_ENV !== 'test' ? real : stub,
      inject: [ConfigService, GooglePlacesNearbyLandmarksProvider, StubLandmarksProvider],
    },
  ],
})
export class AiModule {}
