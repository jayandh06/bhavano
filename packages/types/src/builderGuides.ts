import type { BlogBlock, BlogPost } from "./blogPosts";

/** DRAFT blog posts: "established builders in <city>" for the 11 main cities.
 *
 * Deliberately NOT part of POSTS (blogPosts.ts), so nothing here is published, in the sitemap or in
 * the app until someone has checked the company facts. To publish after review, add
 * `...BUILDER_GUIDE_DRAFTS` to the end of POSTS, add `reviewedBy` for the real people who checked
 * them, and ship. See docs/plans/builder-guides.md and docs/plans/builder-guides-review.md.
 *
 * Framing, by decision (2026-10-24): builders are listed alphabetically, never ranked, and no post
 * says "best" or "top". Each builder gets one short, neutral line (where it is based and the kind
 * of projects it builds). No figures, awards, delivery counts, financial claims or opinions: those
 * are the claims that go stale or can be disputed, and the blog's rules say the site must stand
 * behind anything numeric. The real value of the post is the checking method, which does not age. */

interface BuilderEntry {
  name: string;
  /** One neutral line: where it is based, what it builds. No numbers, no praise. */
  note: string;
}

interface CityGuide {
  /** Slug suffix, also the city's URL slug on the site. */
  citySlug: string;
  city: string;
  /** The authority where projects in this city register, as buyers will find it online. */
  rera: string;
  /** One paragraph of what is specific to buying a home from a builder in this city. */
  localNote: string;
  /** Alphabetical. */
  builders: BuilderEntry[];
}

const GUIDES: CityGuide[] = [
  {
    citySlug: "bengaluru",
    city: "Bengaluru",
    rera: "K-RERA, Karnataka's real estate authority",
    localNote:
      "In Bengaluru the builder is only part of the picture: the land's records and layout approval matter just as much. Read [A khata and B khata in Bengaluru](/blog/a-khata-b-khata-bengaluru) and [BDA-approved sites](/blog/bda-approved-sites-bengaluru) alongside this list.",
    builders: [
      { name: "Adarsh Developers", note: "Bengaluru developer of apartment and villa communities." },
      { name: "Assetz Property Group", note: "Bengaluru-based developer of residential and commercial projects." },
      { name: "Brigade Group", note: "Bengaluru-based; residential, commercial, retail and hospitality projects." },
      { name: "Godrej Properties", note: "Mumbai-headquartered national developer with projects in Bengaluru." },
      { name: "Prestige Group", note: "Bengaluru-based; residential, commercial, retail and hospitality projects." },
      { name: "Puravankara", note: "Bengaluru-based; sells homes under the Purva and Provident names." },
      { name: "Salarpuria Sattva", note: "Bengaluru-based; residential and commercial developments." },
      { name: "Shriram Properties", note: "Bengaluru-based; homes for first-time and mid-range buyers." },
      { name: "Sobha Limited", note: "Bengaluru-based developer of apartments and villas." },
      { name: "Total Environment", note: "Bengaluru-based developer of apartments and villas." },
    ],
  },
  {
    citySlug: "mumbai",
    city: "Mumbai",
    rera: "MahaRERA, Maharashtra's real estate authority",
    localNote:
      "A large share of Mumbai homes come from redevelopment of older buildings. If you are buying in one, ask to see the society's agreement with the builder and the approvals for the new building, not only the sales brochure.",
    builders: [
      { name: "Godrej Properties", note: "Mumbai-headquartered national developer." },
      { name: "Hiranandani Communities", note: "Mumbai-based; township-style residential communities." },
      { name: "K Raheja Corp", note: "Mumbai-based; residential and commercial projects." },
      { name: "Kalpataru", note: "Mumbai-based; residential and commercial projects." },
      { name: "Lodha (Macrotech Developers)", note: "Mumbai-based; large residential and township projects." },
      { name: "Oberoi Realty", note: "Mumbai-based; residential and commercial projects." },
      { name: "Piramal Realty", note: "Mumbai-based; residential projects in Mumbai and Thane." },
      { name: "Runwal Group", note: "Mumbai-based; residential projects in Mumbai and Thane." },
      { name: "Rustomjee", note: "Mumbai-based; residential projects across the suburbs and Thane." },
      { name: "Wadhwa Group", note: "Mumbai-based; residential and redevelopment projects." },
    ],
  },
  {
    citySlug: "delhi-ncr",
    city: "Delhi NCR",
    rera: "the RERA authority of the project's own state (Delhi, Haryana or Uttar Pradesh)",
    localNote:
      "Delhi NCR spans three states. Gurugram and Faridabad register with Haryana's authority, Noida and Ghaziabad with Uttar Pradesh's, and Delhi has its own. Search the authority for the state the project is actually in, and make sure the registration covers the exact tower or phase you are buying.",
    builders: [
      { name: "DLF", note: "Gurugram-headquartered; residential and commercial projects in Gurugram and Delhi." },
      { name: "Emaar India", note: "Gurugram-based Indian arm of the Emaar group." },
      { name: "Godrej Properties", note: "National developer with projects in Gurugram and Noida." },
      { name: "M3M India", note: "Gurugram-based; residential and commercial projects." },
      { name: "Mahindra Lifespace Developers", note: "Mumbai-based; residential projects including in Gurugram." },
      { name: "Max Estates", note: "NCR-based developer of residential and commercial projects." },
      { name: "Sobha Limited", note: "Bengaluru-based developer with projects in Gurugram and Noida." },
      { name: "Tata Housing", note: "Mumbai-based developer with residential projects in Gurugram." },
      { name: "Vatika Group", note: "Gurugram-based; residential and commercial projects." },
    ],
  },
  {
    citySlug: "pune",
    city: "Pune",
    rera: "MahaRERA, Maharashtra's real estate authority",
    localNote:
      "Pune projects register with MahaRERA, the same authority as Mumbai. The city has grown quickly into its edges, so check the project's exact location and which local body approved it, not only the neighbourhood name in the advertisement.",
    builders: [
      { name: "Gera Developments", note: "Pune-based; residential and commercial projects." },
      { name: "Godrej Properties", note: "Mumbai-headquartered national developer with projects in Pune." },
      { name: "Kolte-Patil Developers", note: "Pune-based; residential projects." },
      { name: "Kumar Properties", note: "Pune-based; residential and commercial projects." },
      { name: "Lodha (Macrotech Developers)", note: "Mumbai-based developer with large residential projects in Pune." },
      { name: "Mahindra Lifespace Developers", note: "Mumbai-based developer with residential projects in Pune." },
      { name: "Panchshil Realty", note: "Pune-based; residential and commercial projects." },
      { name: "Paranjape Schemes", note: "Pune-based; residential projects." },
      { name: "Pride Purple Properties", note: "Pune-based; residential and commercial projects." },
      { name: "VTP Realty", note: "Pune-based; residential projects." },
    ],
  },
  {
    citySlug: "hyderabad",
    city: "Hyderabad",
    rera: "Telangana's real estate regulatory authority (TG RERA)",
    localNote:
      "In Hyderabad, ask which authority approved the layout and the building plan, and whether the land use is residential. Read [DTCP-approved plots explained](/blog/dtcp-approved-plots-explained) for how layout approval works in general.",
    builders: [
      { name: "Aparna Constructions", note: "Hyderabad-based; apartments and villas." },
      { name: "Brigade Group", note: "Bengaluru-based developer with projects in Hyderabad." },
      { name: "Godrej Properties", note: "Mumbai-headquartered national developer with projects in Hyderabad." },
      { name: "My Home Group", note: "Hyderabad-based; residential and commercial projects." },
      { name: "Prestige Group", note: "Bengaluru-based developer with projects in Hyderabad." },
      { name: "Rajapushpa Properties", note: "Hyderabad-based; residential projects." },
      { name: "Ramky Estates and Farms", note: "Hyderabad-based; residential and plotted projects." },
      { name: "Salarpuria Sattva", note: "Bengaluru-based developer with projects in Hyderabad." },
      { name: "Sobha Limited", note: "Bengaluru-based developer with projects in Hyderabad." },
      { name: "Vasavi Group", note: "Hyderabad-based; residential projects." },
    ],
  },
  {
    citySlug: "chennai",
    city: "Chennai",
    rera: "TNRERA, Tamil Nadu's real estate authority",
    localNote:
      "In Chennai, ask which body approved the plan: the metropolitan development authority for areas inside its limits, or the state's town and country planning department outside them. Read [DTCP-approved plots explained](/blog/dtcp-approved-plots-explained) for how that approval works.",
    builders: [
      { name: "Akshaya", note: "Chennai-based developer of apartments and villas." },
      { name: "Appaswamy Real Estates", note: "Chennai-based; residential projects." },
      { name: "Casagrand", note: "Chennai-based; residential projects in Chennai and other southern cities." },
      { name: "DAC Developers", note: "Chennai-based; residential projects." },
      { name: "Jain Housing and Constructions", note: "Chennai-based; residential projects." },
      { name: "Lancor Holdings", note: "Chennai-based; residential and commercial projects." },
      { name: "Olympia Group", note: "Chennai-based; residential and commercial projects." },
      { name: "Radiance Realty", note: "Chennai-based; residential projects." },
      { name: "Shriram Properties", note: "Bengaluru-based developer with projects in Chennai." },
      { name: "TVS Emerald", note: "Chennai-based; residential projects." },
    ],
  },
  {
    citySlug: "kolkata",
    city: "Kolkata",
    rera: "West Bengal's real estate regulatory authority (WBRERA)",
    localNote:
      "In Kolkata, ask which civic body sanctioned the building plan and ask to see the sanction, along with the land records. Many older properties and redevelopments have a long chain of ownership, so have a lawyer read the title papers.",
    builders: [
      { name: "Ambuja Neotia", note: "Kolkata-based; residential and commercial developments." },
      { name: "Bengal Peerless", note: "Kolkata-based; residential developments." },
      { name: "Godrej Properties", note: "Mumbai-headquartered national developer with projects in Kolkata." },
      { name: "Merlin Group", note: "Kolkata-based; residential and commercial projects." },
      { name: "PS Group", note: "Kolkata-based; residential and commercial projects." },
      { name: "Shrachi Group", note: "Kolkata-based; residential and commercial projects." },
      { name: "Siddha Group", note: "Kolkata-based; residential projects." },
      { name: "Srijan Realty", note: "Kolkata-based; residential and commercial projects." },
      { name: "Tata Housing", note: "Mumbai-based developer with residential projects in Kolkata." },
      { name: "Unimark Group", note: "Kolkata-based; residential projects." },
    ],
  },
  {
    citySlug: "ahmedabad",
    city: "Ahmedabad",
    rera: "GujRERA, Gujarat's real estate authority",
    localNote:
      "In Ahmedabad, ask which authority approved the plan (the municipal corporation or the urban development authority, depending on where the site is) and whether the land use allows residential building.",
    builders: [
      { name: "Adani Realty", note: "Ahmedabad-headquartered group; residential and township projects." },
      { name: "Applewoods Estate", note: "Ahmedabad-based; residential projects." },
      { name: "Arvind SmartSpaces", note: "Ahmedabad-based; residential projects." },
      { name: "Ganesh Housing", note: "Ahmedabad-based; residential projects." },
      { name: "Goyal and Co.", note: "Ahmedabad-based; residential and commercial projects." },
      { name: "Safal Group", note: "Ahmedabad-based; residential and commercial projects." },
      { name: "Savvy Group", note: "Ahmedabad-based; residential projects." },
      { name: "Shaligram Group", note: "Ahmedabad-based; residential and commercial projects." },
      { name: "Shivalik Group", note: "Ahmedabad-based; residential and commercial projects." },
      { name: "Sun Builders Group", note: "Ahmedabad-based; residential and commercial projects." },
    ],
  },
  {
    citySlug: "jaipur",
    city: "Jaipur",
    rera: "Rajasthan's real estate regulatory authority (Rajasthan RERA)",
    localNote:
      "Fewer Jaipur developers publish independent information than in the larger metros, so the registration check below matters more here. Ask for the land-use conversion and the development authority's approval for the exact plot or tower, and have a lawyer read the title papers.",
    builders: [
      { name: "Ashadeep Group", note: "Jaipur-based; township and group-housing projects." },
      { name: "Mahima Group", note: "Jaipur-based; residential and commercial projects." },
      { name: "Manglam Group", note: "Jaipur-based; residential and commercial projects." },
    ],
  },
  {
    citySlug: "lucknow",
    city: "Lucknow",
    rera: "UP RERA, Uttar Pradesh's real estate authority",
    localNote:
      "Many Lucknow projects are plotted developments or townships rather than single towers. Ask whether the layout has been approved by the development authority, who owns the land, and whether the registration covers the phase you are buying.",
    builders: [
      { name: "Agrasheel Infratech", note: "Lucknow-based developer of plotted townships." },
      { name: "Eldeco Group", note: "Lucknow-based; residential townships and group housing." },
      { name: "Omaxe", note: "Delhi-based developer with township and group-housing projects in Lucknow." },
      { name: "Paarth Infrabuild", note: "Lucknow-based; residential projects." },
      { name: "Shalimar Corp", note: "Lucknow-based; residential and commercial projects." },
      { name: "Signature Infradevelopers", note: "Lucknow-based; residential projects." },
    ],
  },
  {
    citySlug: "coimbatore",
    city: "Coimbatore",
    rera: "TNRERA, Tamil Nadu's real estate authority",
    localNote:
      "Coimbatore has many local developers, often building villas and low-rise apartments in the growing edges of the city. Ask for the planning approval from the local authority and compare each registered project's promised handover date with what the builder has already finished.",
    builders: [
      { name: "Casagrand", note: "Chennai-based developer with residential projects in Coimbatore." },
      { name: "Cotton City Developers", note: "Coimbatore-based; residential and commercial projects." },
      { name: "Elysium Properties", note: "Coimbatore-based; residential and commercial projects." },
      { name: "Gowtham Housing", note: "Coimbatore-based; residential projects." },
      { name: "JRD Realtorss", note: "Coimbatore-based; villa and plot projects." },
      { name: "KK Builders", note: "Coimbatore-based; villas and apartments." },
      { name: "KTVR Vijaydeepa Group", note: "Coimbatore-based; apartment projects." },
      { name: "Sobha Limited", note: "Bengaluru-based developer with villas and apartments in Coimbatore." },
    ],
  },
];

export const BUILDER_GUIDE_PUBLISHED = "2026-10-24";

function body(guide: CityGuide): BlogBlock[] {
  const { city, rera, localNote, builders } = guide;
  return [
    {
      type: "note",
      text: "General information, not advice or an endorsement. This list is in alphabetical order, not a ranking, and it is not complete. No builder paid to be on it. Names, projects and their records change, so check each builder yourself before you pay anything.",
    },
    {
      type: "p",
      text: `When you buy a new home, you are also choosing the builder. In ${city} the same few names come up again and again, which makes it easy to assume a familiar name is a safe one. It is not a substitute for checking. This guide lists developers active in ${city}, with a line on where each is based and what it builds, and then shows you how to check any builder, on this list or not.`,
    },
    { type: "h2", text: `Developers active in ${city}` },
    { type: "ul", items: builders.map((b) => `${b.name}: ${b.note}`) },
    {
      type: "p",
      text: "A builder appearing here says only that it builds homes in the city. It says nothing about the quality of any one project, how it treats buyers, or whether a particular project is registered or approved. Those are things you check project by project.",
    },
    { type: "h2", text: `How to check a builder in ${city}` },
    {
      type: "ol",
      items: [
        `Ask for the registration number of the exact project, and search it on ${rera}. Match the promoter's name, the project name and address, and the completion date with what you were told. See [RERA explained](/blog/rera-explained-for-home-buyers).`,
        "Look at the builder's earlier projects on the same website. Compare the completion date it promised with the one it reported, and see how many ran late.",
        "Check whether the authority has recorded complaints or orders against the builder or the project.",
        "Visit a finished project by the same builder. Speak to residents or the owners' association about the quality of the work, the maintenance and whether promised facilities were delivered.",
        "Ask for the approvals and read them against the [approvals and documents checklist](/blog/property-approvals-documents-checklist).",
        "Ask which stage the project is at and what that means for you. See [which construction stage to buy from](/blog/construction-stage-to-buy-from-builder).",
        "Have a lawyer read the agreement for sale before you sign or pay a booking amount.",
      ],
    },
    { type: "h2", text: `What is specific to ${city}` },
    { type: "p", text: localNote },
    { type: "h2", text: "Questions to ask any builder" },
    {
      type: "ul",
      items: [
        "What is the project's registration number, and which phase or tower does it cover?",
        "Which approvals do you hold, and can I see the documents?",
        "What is the promised handover date, and what happens if it slips?",
        "Is the price quoted on carpet area, and what else will I pay beyond it?",
        "What is the payment schedule, and is each payment tied to a stage of construction?",
        "Who maintains the building after handover, and how are the charges set?",
      ],
    },
    {
      type: "p",
      text: `Ready to look at homes? Browse [homes in ${city}](/${guide.citySlug}) on Bhavano, and use the [home loan EMI calculator](/tools/emi-calculator) to see what a loan would cost before you talk to a builder.`,
    },
  ];
}

export const BUILDER_GUIDE_DRAFTS: BlogPost[] = GUIDES.map((guide) => ({
  slug: `builders-in-${guide.citySlug}`,
  title: `Established builders in ${guide.city}: who to look at and how to check them`,
  description: `Developers active in ${guide.city}, listed alphabetically, and a step-by-step way to check any builder before you pay.`,
  published: BUILDER_GUIDE_PUBLISHED,
  format: "Guide",
  readingMinutes: 5,
  body: body(guide),
}));

/** For tests and the review sheet: the raw entries behind each post. */
export const BUILDER_GUIDE_SOURCE: readonly CityGuide[] = GUIDES;
