import { Module } from '@nestjs/common';
import { SearchInterpretController } from './search-interpret.controller';
import { SearchInterpretLlm } from './search-interpret.llm';
import { SearchInterpretService } from './search-interpret.service';

/** AI second pass for the search bar. PrismaModule and ConfigModule are global; the logger comes
 * from LoggingModule. See docs/plans/ai-sentence-search.md. */
@Module({
  controllers: [SearchInterpretController],
  providers: [SearchInterpretService, SearchInterpretLlm],
})
export class SearchInterpretModule {}
