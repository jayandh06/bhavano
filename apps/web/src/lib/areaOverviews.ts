import { slugify } from "@bhavano/types/slugify";

/** Hand-written overview content for an area's landing page (`/{city}/{area}`), shown below the
 * listings. See docs/plans/area-overview-pages.md.
 *
 * Rules, same spirit as the blog (lib/blog/posts.ts):
 *  - Facts a person can verify (where the area is, what it borders, how it is laid out). No prices,
 *    rents or statistics: any number on the page must come from our own listings, computed live,
 *    never typed in here.
 *  - No legal or financial advice, no claims about specific shops, schools or projects that can
 *    change without notice.
 *  - `reviewed` stays false until someone who knows the area has checked the text. Nothing renders
 *    until it is true, so a draft can sit in the repo without reaching the page. */
export interface AreaFaq {
  question: string;
  answer: string;
}

export interface AreaOverview {
  /** Why this text may (or may not) be shown. Set true only after a local review. */
  reviewed: boolean;
  /** Paragraphs under "About {area}". */
  about: string[];
  /** Paragraphs under "Getting around". */
  gettingAround: string[];
  faqs: AreaFaq[];
}

const OVERVIEWS: Record<string, AreaOverview> = {
  "bengaluru/koramangala": {
    reviewed: false,
    about: [
      "Koramangala is a large residential and commercial neighbourhood in south-east Bengaluru. It is laid out in numbered blocks, from the 1st Block to the 8th Block, and sits between HSR Layout, BTM Layout and Indiranagar.",
      "The area has long been a base for start-ups, offices, cafés and restaurants, so it draws working professionals as well as families. Homes here include independent houses, low-rise apartments and newer apartment buildings.",
    ],
    gettingAround: [
      "Roads such as the Inner Ring Road and Hosur Road connect Koramangala to the rest of the city. Traffic is heavy at peak hours, so check the commute to your office at the time you would actually travel before you decide.",
    ],
    faqs: [
      {
        question: "What are the blocks in Koramangala?",
        answer:
          "Koramangala is divided into numbered blocks, commonly called the 1st Block to the 8th Block. Each block has its own feel and its own price levels, so look at the exact block in a listing rather than the area name alone.",
      },
      {
        question: "What kinds of property can I find in Koramangala on Bhavano?",
        answer:
          "Where listings are available, you can browse apartments, houses, PG rooms and coworking or commercial space. Use the filters on this page to narrow by type, BHK and budget.",
      },
      {
        question: "How do I check a Koramangala listing is genuine?",
        answer:
          "See the place in person before you pay anything, meet the person who will sign the agreement, and get the terms in writing. Bhavano checks listings before they go live but does not inspect properties.",
      },
    ],
  },
};

/** The reviewed overview for a city and area, or undefined when there is none or it has not been
 * reviewed yet. */
export function getAreaOverview(cityName: string, areaName: string): AreaOverview | undefined {
  const overview = OVERVIEWS[`${slugify(cityName)}/${slugify(areaName)}`];
  return overview?.reviewed ? overview : undefined;
}

/** Test hook: every stored overview, reviewed or not. */
export const ALL_AREA_OVERVIEWS = OVERVIEWS;
