/** Blog content lives in code for now: a post is a typed object, rendered by /blog/[slug]. No CMS,
 * no database, no new dependency. Adding a post means adding an entry to POSTS and deploying.
 *
 * Authorship is honest by design. `author` is a real person's name and role, set only when that
 * person actually wrote or reviewed the post; without it the byline is "Bhavano Editorial Team".
 * Don't add invented authors or bios — a byline is a claim about a real person, and this site has a
 * Trust page that says what we do and don't verify.
 *
 * Content rules: general advice and plain explanations only. No prices, rents or statistics unless
 * they come from data the site can stand behind, and no legal or financial advice.
 *
 * Inline links inside text use [label](/path) and are rendered by the post page. */

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "note"; text: string };

export interface BlogPost {
  slug: string;
  title: string;
  /** Meta description and the index card summary. Keep under ~160 characters. */
  description: string;
  /** ISO date. */
  published: string;
  /** ISO date, only when the post was materially revised. */
  updated?: string;
  /** Short label shown on the card, e.g. "Checklist". */
  format: string;
  /** Roughly how long it takes to read, in minutes. */
  readingMinutes: number;
  /** A real person's name and role, if one wrote or reviewed this post. */
  author?: { name: string; role?: string };
  body: BlogBlock[];
}

export const DEFAULT_BYLINE = "Bhavano Editorial Team";

export const POSTS: BlogPost[] = [
  {
    slug: "pg-hunting-checklist",
    title: "PG hunting checklist: what to check before you pay",
    description:
      "A step-by-step checklist for finding a paying-guest room in a new city: what to ask, what to look at on the visit, and what to get in writing.",
    published: "2026-10-15",
    format: "Checklist",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "A PG is the quickest way to start in a new city. You can usually move in within days, with a bed, a cupboard and often meals included. It is also easy to get wrong when you are choosing from another city. Use this list, in order.",
      },
      { type: "h2", text: "Before you visit" },
      {
        type: "ul",
        items: [
          "Decide your must-haves: commute, food, sharing type, and whether you need an AC room.",
          "Shortlist three or four places in [PG listings](/pg) near work or college, so you can see them in one day.",
          "Ask each owner or manager what is included in the monthly amount: food, electricity, Wi-Fi, laundry, cleaning.",
          "Ask about the deposit, how it is returned, and the notice period for leaving.",
        ],
      },
      { type: "h2", text: "On the visit" },
      {
        type: "ol",
        items: [
          "See the exact bed you would get, not only a sample room.",
          "Check the bathroom, water supply and how many people share each bathroom.",
          "Eat a meal there if the food is included, or at least see the kitchen.",
          "Check the locks, the lights on the stairs, the entry rules and the closing time.",
          "Ask current residents how long they have lived there and what they would change.",
          "Walk the route to your office or college at the time you would actually travel.",
        ],
      },
      { type: "h2", text: "Before you pay anything" },
      {
        type: "ul",
        items: [
          "Get the rent, deposit, notice period and house rules in writing, even if it is a short message.",
          "Pay by a traceable method and keep a receipt for every amount.",
          "Never pay a deposit for a room you have not seen, whatever the photos look like.",
          "Check that the photos match the room. If they do not, walk away and [report the listing](/contact).",
        ],
      },
      {
        type: "note",
        text: "Bhavano checks listings before they go live, but we do not inspect properties. Read [how we check listings and what we don't verify](/trust), and always see the place yourself.",
      },
    ],
  },
  {
    slug: "coworking-or-small-office",
    title: "Coworking desk or a small office of your own? How to choose",
    description:
      "A balanced look at coworking and a rented office for freelancers and small teams: flexibility, cost shape, privacy, and when to switch.",
    published: "2026-10-15",
    format: "Comparison",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "Freelancers and small teams in a new city often ask the same question: take a desk in a shared space, or rent a small office. There is no single right answer. It depends on how many people you are, how sure you are about staying, and how much you need privacy.",
      },
      { type: "h2", text: "Where a coworking desk wins" },
      {
        type: "ul",
        items: [
          "Flexibility: shorter commitments than a typical office lease, so a wrong location is cheap to leave.",
          "Lower setup effort: furniture, internet and basics are usually in place on day one.",
          "People around you: useful if you are new to the city and want a network.",
        ],
      },
      { type: "h2", text: "Where your own office wins" },
      {
        type: "ul",
        items: [
          "Privacy: calls, client meetings and sensitive work are easier behind your own door.",
          "Control: you set the layout, the hours and the rules.",
          "Cost shape: for a larger, settled team, a lease can work out better than many individual desks.",
        ],
      },
      { type: "h2", text: "A simple way to decide" },
      {
        type: "ol",
        items: [
          "Count the people who need a seat every day, not the ones who might.",
          "Ask how sure you are about staying in the city for the next year.",
          "List what you would have to buy or set up in your own office: furniture, internet, power backup, cleaning.",
          "Ask both kinds of space the same questions: total monthly cost, deposit, notice period, and what is extra.",
        ],
      },
      {
        type: "p",
        text: "Many small teams start with a [coworking desk or cabin](/coworking) for the first months and move to [their own commercial space](/rent-lease/commercial) once the team and the plan are settled. If you are also moving home, our [moving checklist](/moving-to-a-new-city) covers the whole picture.",
      },
    ],
  },
  {
    slug: "rental-agreement-questions",
    title: "Before you sign a rental agreement: questions to ask",
    description:
      "The questions worth asking about deposit, notice, repairs and rent increases before you sign a house rental agreement. General information, not legal advice.",
    published: "2026-10-15",
    format: "Q&A",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "This is general information to help you ask better questions. It is not legal advice. For anything important, have a lawyer read the agreement.",
      },
      {
        type: "p",
        text: "Most rental problems start with something that was agreed out loud and never written down. These are the questions to settle before you sign, with the reason each one matters.",
      },
      { type: "h2", text: "Who am I renting from?" },
      {
        type: "p",
        text: "Make sure the person signing is the owner, or has the owner's written permission to let the property. If an agent is involved, ask who the agreement is actually with.",
      },
      { type: "h2", text: "What exactly am I paying, and when?" },
      {
        type: "ul",
        items: [
          "The monthly rent and the date it is due.",
          "Whether maintenance, water and electricity are included or billed separately.",
          "How the deposit is held and the conditions for returning it.",
        ],
      },
      { type: "h2", text: "What happens if I want to leave, or the owner does?" },
      {
        type: "ul",
        items: [
          "The notice period each side must give.",
          "Any lock-in period, and what it costs to leave early.",
          "The conditions under which the owner can ask you to vacate.",
        ],
      },
      { type: "h2", text: "Who fixes what?" },
      {
        type: "p",
        text: "Ask who pays for repairs, painting and appliances, and how quickly the owner is expected to respond. Take dated photos of the property's condition on the day you move in.",
      },
      { type: "h2", text: "Can the rent go up?" },
      {
        type: "p",
        text: "Check whether and when the rent can increase during the term, and by how much. If the agreement is silent, ask for it to be written down.",
      },
      {
        type: "p",
        text: "If you are still looking, start with [apartments to rent](/rent-lease/apartment), and use the [rent affordability calculator](/tools/rent-affordability-calculator) to check a rent against your income before you commit.",
      },
    ],
  },
  {
    slug: "spotting-a-bad-property-ad",
    title: "How to spot a property ad that does not add up",
    description:
      "Practical signs that a property listing may be unreliable: photos, prices, pressure to pay, and what to do before you part with money.",
    published: "2026-10-15",
    format: "Explainer",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "Most property ads are honest. A few are not, and the cost of falling for one is a lost deposit and a wasted week. The signs are usually visible if you know where to look.",
      },
      { type: "h2", text: "The photos" },
      {
        type: "p",
        text: "Real listings usually show a mix of rooms, ordinary lighting and a few imperfections. Be careful with photos that look like a brochure, show only one room, or appear on other listings in the same city. Bhavano compares photos against other sellers' photos in the same city when a listing is posted, but a check cannot catch everything, so treat the photos as a starting point.",
      },
      { type: "h2", text: "The price" },
      {
        type: "p",
        text: "A price far below similar homes in the same area is a reason to ask why, not a reason to hurry. Compare it with a few other listings in the same locality before you get excited.",
      },
      { type: "h2", text: "The pressure" },
      {
        type: "ul",
        items: [
          "A request for money before you have seen the property.",
          "\"Another person is paying today\" and similar deadlines.",
          "An owner who is always abroad and can only communicate by message.",
          "A refusal to meet, or to let you see the place with someone you trust.",
        ],
      },
      { type: "h2", text: "What to do instead" },
      {
        type: "ol",
        items: [
          "See the property in person, or send someone you trust.",
          "Meet the person who will sign the agreement and check who they are.",
          "Pay only when the terms are written down, and pay by a method that leaves a record.",
          "If something looks wrong, report it. Use [Contact us](/contact) with a link to the listing.",
        ],
      },
      {
        type: "p",
        text: "We explain what we check before a listing goes live, what our team can take down, and what we do not verify yet, on our [Trust and Safety page](/trust).",
      },
    ],
  },
  {
    slug: "carpet-built-up-super-built-up-area",
    title: "Carpet area, built-up area and super built-up area explained",
    description:
      "What carpet, built-up and super built-up area mean in a flat listing, why the same flat can show three sizes, and how to compare listings fairly.",
    published: "2026-10-18",
    format: "Explainer",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "Two flats can both be called \"1,000 sq ft\" and feel very different once you walk in. The reason is that listings use three different ways of measuring area, and they are not interchangeable.",
      },
      { type: "h2", text: "The three measurements" },
      {
        type: "ul",
        items: [
          "Carpet area: the floor you can actually lay a carpet on, inside the walls of the flat. It leaves out the thickness of the walls.",
          "Built-up area: the carpet area plus the walls and usually balconies and similar attached spaces.",
          "Super built-up area: the built-up area plus a share of the shared spaces in the building, such as the lobby, staircases, lifts and clubhouse.",
        ],
      },
      { type: "h2", text: "Why this matters when you compare" },
      {
        type: "p",
        text: "A larger number is not a larger home. A flat quoted on super built-up area will always show a bigger figure than the same flat quoted on carpet area. When you compare two listings, make sure both numbers are the same kind, or you are comparing different things.",
      },
      { type: "h2", text: "What to ask" },
      {
        type: "ol",
        items: [
          "Ask which of the three areas the listing uses, and ask for the carpet area as well.",
          "For a purchase, check which area the price is quoted on and which one the agreement states.",
          "Measure the rooms yourself on the visit. Walls and fittings tell you more than a brochure figure.",
        ],
      },
      {
        type: "note",
        text: "Rules on how area must be stated differ by state and by project. This is general information, not legal advice. Ask the seller or a lawyer how the area is defined in your agreement.",
      },
      {
        type: "p",
        text: "Need to switch between square feet, square metres and other local units? Use our [area unit converter](/tools/area-unit-converter), then browse [apartments to rent](/rent-lease/apartment) with the same measure in mind.",
      },
    ],
  },
  {
    slug: "rent-or-buy-questions",
    title: "Rent or buy a home? Questions to ask before you decide",
    description:
      "A calm way to think through renting versus buying: your timeline, savings, flexibility and the costs people forget, with no one-size-fits-all answer.",
    published: "2026-10-18",
    format: "Guide",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "This is general information to help you think, not financial advice. For a big decision, talk to a qualified adviser.",
      },
      {
        type: "p",
        text: "Renting and buying are both reasonable. Which one is better depends on your situation, and it can change over time. These questions help you see your own situation more clearly.",
      },
      { type: "h2", text: "How long will you stay?" },
      {
        type: "p",
        text: "Buying usually makes more sense when you expect to stay put for a long time, because the costs of buying and selling are large. If your job or city might change soon, renting keeps you flexible.",
      },
      { type: "h2", text: "What can you comfortably afford?" },
      {
        type: "ul",
        items: [
          "How much you can pay upfront without draining your emergency savings.",
          "Whether a monthly loan payment would still feel comfortable if your income dipped for a while.",
          "Costs beyond the price: registration, brokerage, furnishing, maintenance and society charges.",
        ],
      },
      { type: "h2", text: "What does flexibility mean to you?" },
      {
        type: "p",
        text: "A rented home lets you move for a better job, a better school or a shorter commute. An owned home gives you stability and control over the space. Neither is free of trade-offs.",
      },
      { type: "h2", text: "Try the numbers side by side" },
      {
        type: "p",
        text: "Put your own figures into our [rent vs buy calculator](/tools/rent-vs-buy-calculator) and the [rent affordability calculator](/tools/rent-affordability-calculator). They will not decide for you, but they show how the choices compare for your numbers.",
      },
      {
        type: "p",
        text: "If you decide to rent for now, start with [apartments to rent](/rent-lease/apartment).",
      },
    ],
  },
  {
    slug: "home-loan-emi-explained",
    title: "How a home loan EMI works: tenure, interest and down payment",
    description:
      "A plain explanation of what makes up a home loan EMI and how tenure, interest rate and down payment change it, with links to free calculators.",
    published: "2026-10-18",
    format: "Explainer",
    readingMinutes: 5,
    body: [
      {
        type: "note",
        text: "This is general information, not financial advice. Loan terms differ by lender. Read your own loan documents and ask the lender to explain anything unclear.",
      },
      {
        type: "p",
        text: "An EMI, or equated monthly instalment, is the fixed amount you pay your lender each month until the loan is cleared. Every EMI is part interest and part repayment of the amount you borrowed.",
      },
      { type: "h2", text: "What decides the EMI" },
      {
        type: "ul",
        items: [
          "The loan amount: the price of the home minus your down payment.",
          "The interest rate: the lender's charge for lending you the money.",
          "The tenure: how many months or years you take to repay.",
        ],
      },
      { type: "h2", text: "How the three interact" },
      {
        type: "ul",
        items: [
          "A larger down payment means a smaller loan, so a smaller EMI and less interest paid overall.",
          "A longer tenure lowers each EMI but usually means you pay more interest in total.",
          "A shorter tenure raises each EMI but clears the loan sooner and costs less interest in total.",
        ],
      },
      { type: "h2", text: "Early in the loan, most of the EMI is interest" },
      {
        type: "p",
        text: "In the first years, a larger share of each EMI goes to interest, and the share going to repayment grows later. This is why paying a little extra early can shorten the loan, if your lender allows part-payments. Ask about any charges for doing so.",
      },
      { type: "h2", text: "Work out your own numbers" },
      {
        type: "p",
        text: "Try the [EMI calculator](/tools/emi-calculator) to see how tenure and rate change your payment, the [down payment calculator](/tools/down-payment-calculator) to plan your upfront cost, and the [home loan eligibility calculator](/tools/home-loan-eligibility-calculator) for a rough idea of what a lender may offer.",
      },
    ],
  },
  {
    slug: "flat-viewing-checklist",
    title: "Flat viewing checklist: what to inspect before you rent or buy",
    description:
      "A room-by-room checklist for visiting a flat: water, light, damp, locks, noise and the neighbourhood, so you notice problems before you commit.",
    published: "2026-10-18",
    format: "Checklist",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "Photos show a flat at its best. A visit shows how it really is. Use this list, and take your time. A good owner will not rush you.",
      },
      { type: "h2", text: "Inside the flat" },
      {
        type: "ul",
        items: [
          "Turn on every tap and the shower. Check pressure and how quickly the water drains.",
          "Look at ceilings and corners for damp patches, peeling paint or fresh paint covering something.",
          "Open and close every window, door and cupboard. Check the locks.",
          "Switch every light, fan and socket on. Ask where the main switch board is.",
          "Check mobile signal in each room, and ask about the internet providers that serve the building.",
        ],
      },
      { type: "h2", text: "The building and the street" },
      {
        type: "ul",
        items: [
          "See the lift, staircase, parking and common areas. Are they kept clean and lit?",
          "Ask about water supply timings and power backup.",
          "Stand in the flat at a busy time of day and listen for road, construction or neighbour noise.",
          "Walk to the nearest shop, bus stop or station, the way you would on a normal day.",
        ],
      },
      { type: "h2", text: "Questions for the owner or agent" },
      {
        type: "ol",
        items: [
          "Why is the flat available now, and how long has it been vacant?",
          "What is included: appliances, furniture, parking?",
          "What are the monthly charges apart from rent, such as maintenance?",
          "What does the paperwork look like, and who signs it?",
        ],
      },
      {
        type: "p",
        text: "Take photos of any existing damage with the date, so there is no dispute later. Before you sign, read [our questions to ask about a rental agreement](/blog/rental-agreement-questions). To start looking, browse [apartments to rent](/rent-lease/apartment).",
      },
    ],
  },
  {
    slug: "write-a-property-listing-that-gets-enquiries",
    title: "How to write a property listing that gets real enquiries",
    description:
      "For owners and agents: the photos, details and honest description that make a rental or sale listing easier to trust, so you get fewer time-wasting calls.",
    published: "2026-10-18",
    format: "Guide",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "A good listing answers a buyer or tenant's questions before they ask. That means more serious enquiries and fewer calls that go nowhere. Here is what to include.",
      },
      { type: "h2", text: "Photos first" },
      {
        type: "ul",
        items: [
          "Use daylight. Open the curtains and switch on the lights.",
          "Show every room, the kitchen, the bathrooms and the view or balcony.",
          "Tidy up first. Take photos only of the property itself, not of someone else's listing.",
          "Pick the clearest photo of the living area as the cover.",
        ],
      },
      { type: "h2", text: "A title and description that are specific" },
      {
        type: "p",
        text: "Say what the property is, where it is and what makes it useful: the number of bedrooms, the floor, the furnishing, the nearest landmark. Plain facts work better than capital letters and exclamation marks.",
      },
      { type: "h2", text: "Be honest about the details" },
      {
        type: "ul",
        items: [
          "State the area clearly, and say which kind of area it is.",
          "Mention what is included and what is not: furniture, parking, maintenance.",
          "Say who you are looking for, such as a family, working professionals or students, if it matters.",
          "Keep the price and the property details up to date, and mark the listing closed once it is taken.",
        ],
      },
      { type: "h2", text: "Reply quickly and meet safely" },
      {
        type: "p",
        text: "Reply to messages promptly, share the exact location only when you are ready, and never ask a stranger for a deposit before they have seen the place. Our guide on [spotting a bad property ad](/blog/spotting-a-bad-property-ad) shows what careful tenants and buyers look for, so your listing should pass that test.",
      },
      {
        type: "p",
        text: "When you are ready, you can [post your property on Bhavano](/post).",
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/** Newest first. */
export function sortedPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => b.published.localeCompare(a.published));
}

export function bylineFor(post: BlogPost): string {
  return post.author ? post.author.name : DEFAULT_BYLINE;
}

/** Splits text on [label](/path) links so the page can render them as <Link>s. */
export type InlinePart = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const re = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push({ kind: "text", text: text.slice(last, match.index) });
    parts.push({ kind: "link", text: match[1], href: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}
