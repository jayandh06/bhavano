import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CATEGORY_FIELD_CONFIG } from '@bhavano/types/categoryFields';
import { sanitizeSearchInterpretation, type SearchInterpretationDto } from '@bhavano/types/searchInterpretation';
import { PrismaService } from '../prisma/prisma.service';
import { SearchInterpretLlm } from './search-interpret.llm';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const CITY_LIST_TTL_MS = 60 * 60 * 1000;
const DEFAULT_DAILY_LIMIT = 3000;

const SHARING_TYPES: readonly string[] = (CATEGORY_FIELD_CONFIG.pg.find((f) => f.key === 'sharingType')?.options ?? []).map(
  (o) => o.value,
);

export interface SearchInterpretResponse {
  /** null means "no help available" (not configured, capped, slow, or nothing usable) — the caller
   * carries on with its own rule-based reading, exactly as before AI search existed. */
  interpretation: SearchInterpretationDto | null;
}

/** AI second pass for the search bar — see docs/plans/ai-sentence-search.md. The model only fills a
 * fixed filter shape; everything it returns is validated here before the web app sees it. In-memory
 * cache (same sentence + city, 24 h) and a daily call cap keep the cost bounded; the per-IP throttle
 * lives on the controller. */
@Injectable()
export class SearchInterpretService {
  private readonly cache = new Map<string, { at: number; value: SearchInterpretationDto | null }>();
  private cityNames: { at: number; names: string[] } | null = null;
  private day = '';
  private callsToday = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: SearchInterpretLlm,
    private readonly config: ConfigService,
  ) {}

  async interpret(text: string, browsingCity?: string): Promise<SearchInterpretResponse> {
    const normalized = text.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (normalized.length < 2 || !this.llm.isConfigured()) return { interpretation: null };

    const key = `${normalized.toLowerCase()}|${(browsingCity ?? '').toLowerCase()}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { interpretation: hit.value };

    if (!this.takeDailyBudget()) return { interpretation: null };

    const raw = await this.llm.interpret(normalized, SHARING_TYPES, browsingCity);
    // A failed or timed-out call is not cached, so the next try can succeed.
    if (raw === null) return { interpretation: null };

    const interpretation = sanitizeSearchInterpretation(raw, { cityNames: await this.getCityNames() });
    this.remember(key, interpretation);
    return { interpretation };
  }

  private takeDailyBudget(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.callsToday = 0;
    }
    const limit = Number(this.config.get<string>('AI_SEARCH_DAILY_LIMIT')) || DEFAULT_DAILY_LIMIT;
    if (this.callsToday >= limit) return false;
    this.callsToday += 1;
    return true;
  }

  private remember(key: string, value: SearchInterpretationDto | null): void {
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { at: Date.now(), value });
  }

  private async getCityNames(): Promise<string[]> {
    if (this.cityNames && Date.now() - this.cityNames.at < CITY_LIST_TTL_MS) return this.cityNames.names;
    const rows = await this.prisma.city.findMany({ select: { name: true } });
    const names = rows.map((r) => r.name);
    this.cityNames = { at: Date.now(), names };
    return names;
  }
}
