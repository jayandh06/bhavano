import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Logger } from '@nestjs/common';
import type { GenerateListingCopyResult } from '@bhavano/types/listingCopyAssist';
import { PrismaService } from '../prisma/prisma.service';
import { isListingBoosted } from '../listings/listing-boost.util';
import { GenerateListingCopyDto } from './dto/generate-listing-copy.dto';
import { LISTING_COPY_LLM_PROVIDER, type ListingCopyLlmProvider, type StructuredListingFields } from './providers/listing-copy-llm.provider';
import { NEARBY_LANDMARKS_PROVIDER, type NearbyLandmarksProvider } from './providers/nearby-landmarks.provider';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LISTING_COPY_LLM_PROVIDER) private readonly llm: ListingCopyLlmProvider,
    @Inject(NEARBY_LANDMARKS_PROVIDER) private readonly landmarks: NearbyLandmarksProvider,
  ) {}

  async generate(dto: GenerateListingCopyDto, userId: string): Promise<GenerateListingCopyResult> {
    const { fields: structured, tier, lat, lng } = await this.resolveFields(dto, userId);

    const result: GenerateListingCopyResult = { tierUsed: tier, landmarksUsed: [] };

    if (dto.fields.includes('title')) {
      result.title = await this.llm.generateTitle(structured);
    }

    if (dto.fields.includes('description')) {
      let landmarkNames: string[] = [];
      // Featured-only (by far the most expensive call in this pipeline) and best-effort — a
      // Places failure must never block description generation, it just means no landmarks get
      // narrated this time. See docs/plans/ai-listing-copy-assist.md.
      if (tier === 'featured' && lat !== undefined && lng !== undefined) {
        try {
          landmarkNames = await this.landmarks.findNearby(lat, lng);
        } catch (error) {
          this.logger.warn(`Nearby-landmarks lookup failed, continuing without it: ${error}`);
        }
      }

      const { text, secondLanguageText } = await this.llm.generateDescription({
        ...structured,
        tier,
        landmarks: landmarkNames,
        secondLanguage: tier === 'featured' ? dto.secondLanguage : undefined,
      });
      result.description = text;
      result.descriptionSecondLanguage = secondLanguageText;
      result.landmarksUsed = landmarkNames;
    }

    return result;
  }

  /** The two valid request shapes — see GenerateListingCopyInput's own doc comment for why.
   * Tier and every structured field come from the DB, never the client, the moment a real
   * `listingId` is given; only the no-listing (details-step) shape trusts client-supplied
   * fields, and even then the tier is always 'free' since nothing can be boosted yet. */
  private async resolveFields(
    dto: GenerateListingCopyDto,
    userId: string,
  ): Promise<{ fields: StructuredListingFields; tier: 'free' | 'featured'; lat?: number; lng?: number }> {
    if (dto.listingId) {
      const listing = await this.prisma.listing.findUnique({
        where: { id: dto.listingId },
        include: { city: true, area: true },
      });
      if (!listing) throw new NotFoundException(`Listing ${dto.listingId} not found`);
      if (listing.ownerId !== userId) throw new ForbiddenException("You don't own this listing");

      return {
        fields: {
          category: listing.category,
          transactionType: listing.transactionType,
          price: listing.price,
          priceQualifier: listing.priceQualifier || undefined,
          cityName: listing.city.name,
          areaName: listing.area.name,
          attributes: (listing.attributes as Record<string, unknown>) ?? undefined,
        },
        tier: isListingBoosted(listing) ? 'featured' : 'free',
        lat: listing.lat ?? undefined,
        lng: listing.lng ?? undefined,
      };
    }

    // No listingId — the posting wizard's "details" step, before any real Listing row exists.
    // Tier is hardcoded here, never from anything the client sends: there is categorically
    // nothing to be boosted yet.
    if (!dto.category || !dto.transactionType) {
      throw new BadRequestException('category and transactionType are required when no listingId is given');
    }
    return {
      fields: {
        category: dto.category,
        transactionType: dto.transactionType,
        price: dto.price,
        priceQualifier: dto.priceQualifier,
        cityName: dto.cityName,
        areaName: dto.areaName,
        attributes: dto.attributes,
      },
      tier: 'free',
      lat: dto.lat,
      lng: dto.lng,
    };
  }
}
