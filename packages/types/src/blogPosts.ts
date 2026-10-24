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

import { BUILDER_GUIDES } from "./builderGuides";

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
  /** A real person's name and role, if one wrote this post. */
  author?: { name: string; role?: string };
  /** Real people who actually read and checked this post, shown as "Reviewed by". Set only after
   * each person has confirmed they reviewed it, and describe their role honestly: a reviewer who is
   * not a lawyer must not be presented as one, however legal the topic. */
  reviewedBy?: { name: string; role?: string }[];
  /** A real photograph for this article, shown instead of the drawn cover (blogCovers.ts). Set only
   * for a photo whose licence allows commercial use, with its source recorded in
   * docs/plans/blog-image-credits.md. `src` is a path under /blog/covers/, 1200 by 630. */
  cover?: { src: string; alt: string; credit?: string; creditUrl?: string; licence?: string };
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
    updated: "2026-10-21",
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
      { type: "h2", text: "Should I rent or buy? A side-by-side cost comparison" },
      {
        type: "p",
        text: "Compare the yearly cost of living in the home, not the price against the rent. Put the same items on each side.",
      },
      {
        type: "ul",
        items: [
          "Renting costs: the rent, the rent increase each year, the deposit tied up (it earns you nothing), brokerage when you move, and moving costs.",
          "Buying costs: the interest part of your loan payments (the repayment part builds your ownership), property tax, society maintenance, repairs, insurance, and the return you give up on the down payment.",
          "One-time costs of buying: stamp duty, registration, brokerage and loan fees. See [stamp duty and registration explained](/blog/stamp-duty-and-registration-charges-explained).",
          "What buying adds: the home's price may rise or fall, and you own what you paid for.",
        ],
      },
      { type: "h2", text: "How do I work out the break-even point?" },
      {
        type: "p",
        text: "A simple version: add up the yearly cost of owning (without any price growth), subtract the yearly rent for a similar home, and divide the difference by the home's price. The result is the yearly price growth the home needs for owning to cost the same as renting. If you expect prices to rise faster than that, buying comes out ahead on these numbers. If you expect them to rise slower, renting does.",
      },
      {
        type: "p",
        text: "Worked example, for illustration only. A home priced at 5,000,000 rupees rents for 20,000 a month, or 240,000 a year. Buying it with a 1,000,000 down payment means a loan of 4,000,000. Say the first-year costs of owning are interest of 360,000, maintenance of 36,000, property tax of 6,000, and 60,000 of return given up on the down payment: 462,000 in all. The difference from renting is 462,000 - 240,000 = 222,000, and 222,000 / 5,000,000 = about 4.4 per cent a year. The price would need to grow by about that much a year, just to break even, before counting the one-time costs of buying. These numbers are made up, so replace them with your own. A short stay makes buying harder to justify, because the one-time costs are spread over fewer years.",
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
    updated: "2026-10-21",
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
      { type: "h2", text: "How is a home loan EMI calculated?" },
      {
        type: "p",
        text: "EMI = P x r x (1 + r)^n / ((1 + r)^n - 1). Here P is the loan amount, r is the monthly interest rate (the yearly rate divided by 12 and by 100), and n is the number of monthly payments (years x 12). Lenders use this formula, so a calculator will give you the same answer.",
      },
      {
        type: "p",
        text: "Worked example, for illustration only. Borrow 2,000,000 rupees at 9 per cent a year for 20 years. The monthly rate r is 9 / 12 / 100 = 0.0075, and n is 240. (1.0075)^240 is about 6.009, so EMI = 2,000,000 x 0.0075 x 6.009 / 5.009 = about 17,995 a month. Over 240 months you would pay about 4,318,800 in total, of which about 2,318,800 is interest. Change any one of the three inputs and the EMI changes, which is what the calculators below let you try.",
      },
      {
        type: "p",
        text: "The EMI rises in direct proportion to the loan amount at the same rate and tenure, so a bigger down payment lowers it. See [how much down payment you need](/blog/down-payment-for-a-home-loan).",
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
        text: "When you are ready, you can [post your property on Bhavano](/post). Selling rather than renting? Read our [complete guide to selling property online](/blog/how-to-sell-property-online-in-india).",
      },
    ],
  },
  {
    slug: "buying-a-plot-checklist",
    title: "Buying a plot of land: documents and checks before you pay",
    description:
      "A plain checklist for buying a residential plot: ownership papers, approvals, boundaries and payment, so you know what to ask before you commit.",
    published: "2026-10-19",
    format: "Checklist",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "This is general information to help you ask better questions. It is not legal advice. Have a lawyer read the documents before you pay anything.",
      },
      {
        type: "p",
        text: "A plot looks simple: land, a boundary and a price. In practice, most plot problems are about paperwork you cannot see from the road. Work through these checks in order before you pay a token amount.",
      },
      { type: "h2", text: "Ownership" },
      {
        type: "ul",
        items: [
          "Ask the seller for the title documents and check that the seller's name is the one on them.",
          "Ask how the seller came to own the land: purchase, inheritance, gift or allotment. Each leaves a different paper trail.",
          "If there are several owners, every one of them must agree to the sale in writing.",
          "Ask whether the plot is free of loans, disputes and court cases, and ask for that in writing.",
        ],
      },
      { type: "h2", text: "Approvals and use of the land" },
      {
        type: "ul",
        items: [
          "Check that the layout is approved by the local authority and that the plot is meant for residential use.",
          "Ask what you are allowed to build, including height and set-back rules, before you imagine the house.",
          "Confirm that roads, drainage, water and power are in place, or who will provide them and by when.",
        ],
      },
      { type: "h2", text: "The land itself" },
      {
        type: "ol",
        items: [
          "Visit the plot in person and walk its boundary.",
          "Compare the actual size with the size in the documents.",
          "Look for encroachment, a shared wall or a path that crosses the plot.",
          "Visit after rain if you can, to see whether water collects there.",
        ],
      },
      { type: "h2", text: "Payment and registration" },
      {
        type: "ul",
        items: [
          "Agree the terms in a written agreement before paying any large amount.",
          "Pay by a method that leaves a record, and keep every receipt.",
          "Complete the registration in the correct office and keep certified copies of everything.",
        ],
      },
      {
        type: "p",
        text: "When you are ready to look, browse [plots for sale](/plot) and use the [area unit converter](/tools/area-unit-converter) if a listing quotes a size in a unit you do not use every day. Bhavano checks listings before they go live but does not verify land documents, so read [how we check listings and what we don't verify](/trust). Selling a plot yourself? See our [complete guide to selling property online](/blog/how-to-sell-property-online-in-india).",
      },
    ],
  },
  {
    slug: "real-estate-investment-basics",
    title: "Real estate investment basics: what first-time buyers should understand",
    description:
      "How property earns money (rent and value growth), what can go wrong, and the questions to ask before buying a flat or plot as an investment.",
    published: "2026-10-19",
    format: "Explainer",
    readingMinutes: 7,
    body: [
      {
        type: "note",
        text: "This is general education, not investment or financial advice. Property can lose value and can be hard to sell. Talk to a qualified adviser about your own situation.",
      },
      {
        type: "p",
        text: "People buy property to live in, to earn rent, or to hold it as it grows in value. Many do a mix of these. Before treating a purchase as an investment, it helps to understand where the money comes from and where it can leak away.",
      },
      { type: "h2", text: "How property can earn money" },
      {
        type: "ul",
        items: [
          "Rent: regular income from a tenant, after costs such as maintenance, taxes and gaps between tenants.",
          "Appreciation: the property may be worth more when you sell, but this is never guaranteed and can take years.",
          "Use: living in it yourself can replace the rent you would otherwise pay.",
        ],
      },
      { type: "h2", text: "Costs people forget" },
      {
        type: "ul",
        items: [
          "Registration, stamp duty and brokerage when you buy, and again when you sell.",
          "Loan interest, if you borrow, which can be larger than the rent you collect.",
          "Maintenance, repairs, society charges and property tax.",
          "Months with no tenant, and the effort of finding a new one.",
        ],
      },
      { type: "h2", text: "Risks to weigh" },
      {
        type: "ul",
        items: [
          "Liquidity: selling a property takes time, and you may not get the price you hoped for when you need the money.",
          "Concentration: one property in one area puts a lot of your savings in a single place.",
          "Project and legal risk: delays, disputes and missing approvals, especially with plots and under-construction homes.",
          "Location risk: an area's rents and demand can change as jobs and transport change.",
        ],
      },
      { type: "h2", text: "Questions to ask before you buy" },
      {
        type: "ol",
        items: [
          "Could I carry the costs if the property stayed empty for several months?",
          "Is this area one where people actually want to rent or buy, and why?",
          "What would I do if I needed my money back in a hurry?",
          "Have I compared this with simply renting and investing the difference?",
        ],
      },
      {
        type: "p",
        text: "Try the [rent vs buy calculator](/tools/rent-vs-buy-calculator) and the [EMI calculator](/tools/emi-calculator) with your own figures. When you are ready to look, browse [apartments for sale](/buy/apartment), and read our guide on [flat viewing](/blog/flat-viewing-checklist).",
      },
    ],
  },
  {
    slug: "ready-to-move-vs-under-construction",
    title: "Ready-to-move or under-construction flat: how to choose",
    description:
      "The trade-offs between buying a ready-to-move flat and an under-construction one: timing, risk, flexibility and what to verify for each.",
    published: "2026-10-19",
    updated: "2026-10-21",
    format: "Comparison",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "When you shop for a flat to buy, you will see two kinds: ready-to-move homes you can see and occupy, and under-construction homes that are still being built. Neither is better in every case. The right one depends on how soon you need a home and how much uncertainty you can accept.",
      },
      { type: "h2", text: "Ready-to-move: what to expect" },
      {
        type: "ul",
        items: [
          "You see exactly what you are buying, including the view, the light and the neighbours.",
          "You can move in, or start renting it out, soon after you finish the paperwork.",
          "You are not paying rent somewhere else while you wait.",
          "There is usually less choice of layout and fittings than in a new project.",
        ],
      },
      { type: "h2", text: "Under-construction: what to expect" },
      {
        type: "ul",
        items: [
          "You buy from a plan, so you rely on the builder to deliver what was promised.",
          "Payments are often spread over stages of construction, which can suit your cash flow.",
          "Delays are possible, and during them you may pay rent and a loan at the same time.",
          "You may get more choice of unit, floor and layout, and newer facilities.",
        ],
      },
      { type: "h2", text: "Which is better: price, payment plan, possession risk and tax compared" },
      {
        type: "ul",
        items: [
          "Price: under-construction homes are often priced lower per square foot at launch, with the price tending to rise as construction progresses. A ready home is priced for what it is now, and you can compare it with other [apartments for sale](/buy/apartment).",
          "Payment plan: a ready home is usually paid in full at purchase, with the loan released at once. An under-construction home is paid in stages tied to construction, so you pay loan interest only on the amount released so far. Check the schedule in the agreement.",
          "Possession risk: a ready home carries almost none, because you can see it and move in. An under-construction home can be delayed, so ask for the handover date in writing and check the project's RERA registration. See [RERA explained](/blog/rera-explained-for-home-buyers).",
          "Paperwork: a ready home should have its completion and occupancy certificate. An under-construction one needs approved plans and a registered project. See [occupancy and completion certificates](/blog/occupancy-certificate-and-completion-certificate).",
          "Tax: indirect tax on the purchase, such as GST, can apply differently to a home that is still being built than to a completed one with its certificate, and loan tax benefits can depend on whether you have taken possession. These rules change, so confirm them with a tax adviser before you decide.",
        ],
      },
      { type: "h2", text: "What to check for each" },
      {
        type: "ol",
        items: [
          "For a ready home: the completion and occupancy papers, the society's dues, and who owns the parking space.",
          "For an under-construction home: the project's approvals, the builder's earlier projects, and the promised handover date in writing.",
          "For both: the payment schedule, what is included in the price, and what happens if either side cancels.",
        ],
      },
      {
        type: "note",
        text: "Rules for builders and buyers differ by state and project. This is general information, not legal advice. Have a lawyer read the agreement.",
      },
      {
        type: "p",
        text: "Browse [apartments for sale](/buy/apartment) and compare the listings you shortlist. Our [flat viewing checklist](/blog/flat-viewing-checklist) covers what to inspect on a ready home, and the [home loan EMI guide](/blog/home-loan-emi-explained) helps you plan the payments.",
      },
    ],
  },
  {
    slug: "how-to-sell-your-house-or-flat-online",
    title: "How to sell your house or flat online: a step-by-step guide",
    description:
      "From preparing the paperwork to replying to buyers: how to sell a house or flat online safely, with the steps owners often skip.",
    published: "2026-10-19",
    format: "Guide",
    readingMinutes: 6,
    body: [
      {
        type: "p",
        text: "Selling a property yourself is possible, and many owners do it. It goes more smoothly when you prepare first and know what buyers will ask. Here is the order that tends to work.",
      },
      { type: "h2", text: "1. Get your papers in order" },
      {
        type: "ul",
        items: [
          "Collect the ownership documents, the latest tax receipts and any society or maintenance clearances.",
          "If there is a loan on the property, ask your lender what is needed to release it when you sell.",
          "Check that names and areas match across your documents, and fix any differences before a buyer notices them.",
        ],
      },
      { type: "h2", text: "2. Decide how you want to sell" },
      {
        type: "p",
        text: "Decide how quickly you need to sell and how flexible you are. A seller who is in no hurry can wait for the right buyer. A seller who is in a hurry should expect to negotiate more. Look at similar listings nearby to see how others describe and present their homes.",
      },
      { type: "h2", text: "3. Create a clear listing" },
      {
        type: "ul",
        items: [
          "Take bright photos of every room, the kitchen, the bathrooms and the building.",
          "Describe the property honestly: size, floor, furnishing, parking, age and what is included.",
          "State which kind of area your size refers to, so buyers can compare fairly.",
        ],
      },
      { type: "h2", text: "4. Handle enquiries safely" },
      {
        type: "ul",
        items: [
          "Reply promptly and answer questions plainly.",
          "Meet buyers at the property, and keep personal documents with you.",
          "Be cautious of anyone who asks you to pay a fee first, or who offers to pay more than you asked without seeing the property.",
        ],
      },
      { type: "h2", text: "5. Agree terms and complete the sale" },
      {
        type: "p",
        text: "Put the price, the token amount, the timeline and the conditions in a written agreement. Complete the transfer through the proper registration process and keep copies of everything. Use a lawyer for this step. This is general information, not legal advice.",
      },
      {
        type: "p",
        text: "Ready to list? You can [post your property on Bhavano](/post). Our guide to [writing a listing that gets enquiries](/blog/write-a-property-listing-that-gets-enquiries) covers the listing step in more detail, and you can see how others present [houses for sale](/buy/house). For every property type and the full process, see our [complete guide to selling property online](/blog/how-to-sell-property-online-in-india).",
      },
    ],
  },
  {
    slug: "how-to-find-reliable-tenants",
    title: "Renting out your house: how to find a reliable tenant",
    description:
      "How owners can attract good tenants and avoid common problems: pricing, screening, the agreement, the deposit and house rules.",
    published: "2026-10-19",
    format: "Guide",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "This is general information, not legal advice. Rules on rent, deposits and notice differ by state. Have a lawyer read your agreement.",
      },
      {
        type: "p",
        text: "A good tenant pays on time, looks after the home and leaves on good terms. You cannot guarantee that, but a careful process makes it far more likely.",
      },
      { type: "h2", text: "Before you list" },
      {
        type: "ul",
        items: [
          "Fix what is broken and make the home clean. It lets you ask for a fair rent and attracts better applicants.",
          "Look at similar homes nearby and price yours alongside them, not far above or below.",
          "Decide your rules in advance: who can live there, pets, sub-letting, visitors and smoking.",
        ],
      },
      { type: "h2", text: "Screening an applicant" },
      {
        type: "ol",
        items: [
          "Meet the applicant in person, and meet everyone who will live there.",
          "Ask about work or study, and ask for proof of identity.",
          "Ask for a reference from a previous landlord and call them.",
          "Trust your own sense. If the story keeps changing, move on.",
        ],
      },
      { type: "h2", text: "The agreement and the deposit" },
      {
        type: "ul",
        items: [
          "Put the rent, due date, deposit, notice period, repairs and rules in a written agreement that both sides sign.",
          "Record the condition of the home with dated photos, and have the tenant sign them.",
          "Take payments by a method that leaves a record, and give a receipt.",
        ],
      },
      { type: "h2", text: "During the tenancy" },
      {
        type: "p",
        text: "Respond to repair requests promptly, give notice before you visit, and keep records of everything. Good communication prevents most disputes.",
      },
      {
        type: "p",
        text: "To find applicants, [post your property on Bhavano](/post). Look at [houses for rent](/rent-lease/house) and [apartments for rent](/rent-lease/apartment) to see how similar homes are presented, and share our [questions to ask before signing a rental agreement](/blog/rental-agreement-questions) with your tenant, since the agreement works best when both sides understand it.",
      },
    ],
  },
  {
    slug: "commercial-space-for-rent-what-to-check",
    title: "Shop, office or warehouse for rent: what to check before you sign",
    description:
      "How to choose and check a commercial space to rent: location, layout, running costs, the lease terms and the permissions your business needs.",
    published: "2026-10-19",
    format: "Checklist",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "This is general information, not legal advice. Commercial leases can be complex, so have a lawyer read yours before you sign.",
      },
      {
        type: "p",
        text: "Renting a commercial space is a bigger commitment than renting a home. The rent is only part of the cost, and a wrong choice can be expensive to leave. Start with what your business actually needs.",
      },
      { type: "h2", text: "Match the space to the business" },
      {
        type: "ul",
        items: [
          "Shop: footfall, visibility from the road, parking and the neighbours on either side.",
          "Office: desk space, meeting rooms, internet, power backup and commute for your team.",
          "Warehouse or storage: road access for large vehicles, loading space, floor strength and security.",
        ],
      },
      { type: "h2", text: "Check the running costs" },
      {
        type: "ul",
        items: [
          "Ask what is included in the rent and what is billed separately: maintenance, electricity, water and parking.",
          "Ask about the deposit, how it is held and when it is returned.",
          "Ask how the rent can change over the lease term, and in writing.",
        ],
      },
      { type: "h2", text: "Check the permissions" },
      {
        type: "ol",
        items: [
          "Confirm the property is allowed to be used for your kind of business.",
          "Ask what licences you will need and whether the space qualifies.",
          "Confirm who is responsible for fire safety, signage and approvals.",
        ],
      },
      { type: "h2", text: "Read the lease carefully" },
      {
        type: "ul",
        items: [
          "The lease term, any lock-in period and what it costs to leave early.",
          "The notice period each side must give.",
          "Who pays for repairs and fit-out, and what happens to the fit-out when you leave.",
          "Whether you may sub-let or share the space.",
        ],
      },
      {
        type: "p",
        text: "Browse [commercial space for rent](/rent-lease/commercial), or consider a [coworking desk or cabin](/coworking) if you want a shorter commitment. Our guide on [coworking or a small office](/blog/coworking-or-small-office) helps you compare. You can also [buy commercial property](/buy/commercial) if you plan to stay long term.",
      },
    ],
  },
  {
    slug: "villa-or-apartment-which-to-choose",
    title: "Villa or apartment: which is right for you?",
    description:
      "An honest comparison of living in a villa and in an apartment: space, upkeep, security, community, cost shape and who each suits best.",
    published: "2026-10-19",
    format: "Comparison",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "Both can be a good home. The choice is less about which is better and more about which fits how you live. Here is how they usually differ.",
      },
      { type: "h2", text: "Space and privacy" },
      {
        type: "ul",
        items: [
          "A villa usually gives you your own entrance, garden or terrace and more room to change things.",
          "An apartment shares walls, a lift and common areas, but is often easier to keep and move around in.",
        ],
      },
      { type: "h2", text: "Upkeep and cost" },
      {
        type: "ul",
        items: [
          "A villa can mean more to maintain: garden, roof, boundary and repairs are your job.",
          "An apartment usually comes with a monthly maintenance charge that covers common areas, and sometimes security and amenities.",
          "Ask for the full running costs of each, not only the rent or price.",
        ],
      },
      { type: "h2", text: "Security and community" },
      {
        type: "ul",
        items: [
          "Gated apartment communities and villa communities often share security and amenities. Check what is actually provided.",
          "A standalone villa gives you privacy but less shared security.",
        ],
      },
      { type: "h2", text: "A simple way to decide" },
      {
        type: "ol",
        items: [
          "List the space you really need now and in the next few years.",
          "List the upkeep you are willing to do or pay for.",
          "Think about who lives with you: children, older relatives, pets.",
          "Compare the full monthly cost of both, including maintenance and travel.",
        ],
      },
      {
        type: "p",
        text: "Browse [villas for sale](/buy/villa) and [apartments for sale](/buy/apartment), or look at [villas for rent](/rent-lease/villa) and [apartments for rent](/rent-lease/apartment) if you want to try an area first.",
      },
    ],
  },
  {
    slug: "storage-space-for-rent",
    title: "Storage space for rent: when to use it and what to ask",
    description:
      "When renting a storage unit makes sense, how to compare them, and the questions to ask about access, security, insurance and the contract.",
    published: "2026-10-19",
    format: "Guide",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "A storage space can solve a real problem: you are moving between homes, downsizing, running a small business from home, or just short on room. It works best when you know what you will store and for how long.",
      },
      { type: "h2", text: "When storage makes sense" },
      {
        type: "ul",
        items: [
          "Between homes, when your new place is not ready yet.",
          "When you move to a smaller place and want to keep furniture for later.",
          "For stock, tools or documents for a small business.",
          "For seasonal items you do not want at home.",
        ],
      },
      { type: "h2", text: "What to ask before you rent" },
      {
        type: "ul",
        items: [
          "Access: when can you get in, and is there a lift, a ramp or a place for a vehicle to stop?",
          "Security: locks, CCTV, a guard, and who else has a key.",
          "Conditions: is it dry and ventilated, and is there any risk of damp, pests or flooding?",
          "Insurance: whether your items are covered, and who is responsible if something is damaged.",
          "Rules: what you may not store, and whether you may use the space as a workshop or office.",
        ],
      },
      { type: "h2", text: "Pack and protect your things" },
      {
        type: "ol",
        items: [
          "Clean and dry everything before it goes in.",
          "Use strong boxes and label every one.",
          "Raise items off the floor and leave a path so you can reach them.",
          "Keep a list of what is inside, with photos.",
        ],
      },
      { type: "h2", text: "Read the contract" },
      {
        type: "p",
        text: "Check the monthly amount, the deposit, the notice period and what happens if you pay late. Keep a copy of the agreement and every receipt.",
      },
      {
        type: "p",
        text: "Browse [storage space for rent](/storage), and if you are moving city, our [moving checklist](/moving-to-a-new-city) covers the rest of the move.",
      },
    ],
  },
  {
    slug: "property-approvals-documents-checklist",
    title: "Approved property: the documents and approvals to check before you buy",
    description:
      "A plain guide to the papers that show a plot, flat or house is legal to buy: title, approvals, RERA, occupancy certificate and khata, and what each one proves.",
    published: "2026-10-19",
    format: "Checklist",
    readingMinutes: 7,
    reviewedBy: [{ name: "Jayandhan Rajasundaram" }, { name: "Anitha Narayanasamy" }],
    body: [
      {
        type: "note",
        text: "This is general information, not legal advice. Names, rules and offices differ by state and city, and they change. Have a lawyer read the documents for any purchase, and confirm each item with the issuing authority.",
      },
      {
        type: "p",
        text: "Two different questions sit behind every property purchase. First: does the seller really own it? Second: was it built or laid out with the permissions the law requires? Different papers answer each one, and a buyer needs both.",
      },
      { type: "h2", text: "Papers that show who owns it" },
      {
        type: "ul",
        items: [
          "The sale deed or title deed in the seller's name, and the earlier deeds that show how ownership reached them.",
          "An encumbrance certificate, which shows whether the property has loans or other claims registered against it.",
          "The property tax receipts and the local authority's own record of the owner, such as the khata or mutation entry.",
        ],
      },
      { type: "h2", text: "Approvals that show the land is allowed to be developed" },
      {
        type: "ul",
        items: [
          "Land use: the land must be permitted for the use you intend, and farmland needs to have been converted for residential use.",
          "Layout approval: for a plot, the layout should be sanctioned by the planning authority. Read about [DTCP approved plots](/blog/dtcp-approved-plots-explained) and [BDA approved sites in Bengaluru](/blog/bda-approved-sites-bengaluru).",
        ],
      },
      { type: "h2", text: "Approvals that show the building is legal" },
      {
        type: "ul",
        items: [
          "A sanctioned building plan, and a commencement certificate that allowed construction to start.",
          "A completion certificate and an [occupancy certificate](/blog/occupancy-certificate-and-completion-certificate) once the building is finished.",
          "For new projects, a [RERA registration](/blog/rera-explained-for-home-buyers) and the number that goes with it.",
        ],
      },
      { type: "h2", text: "A simple order to work through" },
      {
        type: "ol",
        items: [
          "Ask the seller for copies of every paper above before you pay a token amount.",
          "Check each approval with the authority that issued it, not only on the copy you were given.",
          "Check that names, plot or flat numbers and survey details match across every document.",
          "Have a lawyer read the title and the approvals, and ask what is missing.",
          "Pay only after the agreement spells out what you are buying and what happens if a paper turns out to be wrong.",
        ],
      },
      { type: "h2", text: "What approvals can and cannot tell you" },
      {
        type: "p",
        text: "An approval shows that an authority examined the plan or the building against its rules, which lowers the risk of buying something that cannot be built on, financed or sold. It does not prove that the seller owns the property, that the price is fair, or that the work is good. That is why the title papers and your own visit still matter.",
      },
      {
        type: "p",
        text: "Bhavano checks listings before they go live but does not verify land or building documents. Read [how we check listings and what we don't verify](/trust). Then browse [plots for sale](/plot) or [apartments for sale](/buy/apartment), and see our guides on [buying a plot](/blog/buying-a-plot-checklist) and on [ready-to-move or under-construction homes](/blog/ready-to-move-vs-under-construction). If you are the seller, our [complete guide to selling property online](/blog/how-to-sell-property-online-in-india) covers which papers buyers ask for.",
      },
    ],
  },
  {
    slug: "rera-explained-for-home-buyers",
    title: "RERA explained: what it is and what it means for a home buyer",
    description:
      "What the Real Estate (Regulation and Development) Act is, which projects must register, what you can check, and what a RERA number does and does not promise.",
    published: "2026-10-19",
    updated: "2026-10-21",
    format: "Explainer",
    readingMinutes: 6,
    reviewedBy: [{ name: "Jayandhan Rajasundaram" }, { name: "Anitha Narayanasamy" }],
    body: [
      {
        type: "note",
        text: "This is general information, not legal advice. Each state runs its own RERA authority with its own rules and website. Check the current rules with your state's authority or a lawyer.",
      },
      {
        type: "p",
        text: "RERA stands for the Real Estate (Regulation and Development) Act, 2016. It is a national law meant to make buying a home from a builder more transparent and to give buyers a place to complain. Each state sets up its own authority to register projects and handle disputes.",
      },
      { type: "h2", text: "What the law asks of builders" },
      {
        type: "ul",
        items: [
          "Register a project with the state authority before advertising or selling it, if it is above the size the law sets.",
          "Publish key facts about the project: who the promoter is, the approvals held, the layout, the promised completion date and its progress.",
          "Sell by carpet area, the usable floor area inside the walls, so that buyers can compare fairly.",
          "Keep a large share of the money collected from buyers in a separate account for that project, so it is used for that project and not moved elsewhere.",
          "Answer for delay and for defects: the law provides for interest or compensation when possession is late, and for fixing structural defects for a period after handover.",
        ],
      },
      { type: "h2", text: "Why a registered project is more credible" },
      {
        type: "p",
        text: "Registration means the builder has put the project's approvals, plans and timeline on a public record, and can be held to them. It gives you a number to check, a paper trail to compare against what you were told, and an authority to approach if things go wrong. A project that avoids registration when it should register is a warning sign.",
      },
      { type: "h2", text: "How to check a project" },
      {
        type: "ol",
        items: [
          "Ask for the RERA registration number. Genuine projects show it in their advertising.",
          "Search the number on your state RERA authority's official website.",
          "Compare the promoter's name, the project name and address, the completion date and the status with what you were told.",
          "Read the approvals listed there, and check them against the [documents in our checklist](/blog/property-approvals-documents-checklist).",
        ],
      },
      { type: "h2", text: "What if the project is not registered?" },
      {
        type: "ul",
        items: [
          "Ask the builder, in writing, for the registration number. A project that needs registration and has none is a serious warning sign.",
          "Search the project and the builder by name on your state's RERA website. A different spelling or a different phase can hide a real registration.",
          "Some small or completed projects may be outside the Act. Ask which exemption applies and have your lawyer confirm it.",
          "Do not pay a booking amount or sign an agreement until you have the answer.",
          "If a builder is advertising or selling an unregistered project that needs registration, you can report it to your state's RERA authority.",
          "If in doubt, choose a registered project or a ready home. See [ready-to-move or under-construction](/blog/ready-to-move-vs-under-construction).",
        ],
      },
      { type: "h2", text: "What RERA does not do" },
      {
        type: "ul",
        items: [
          "It does not guarantee quality, the price or that the project will finish on time. It gives you remedies if it does not.",
          "Small projects and some older, completed ones can fall outside it, depending on the state's rules.",
          "It covers the project, not the neighbourhood, and it does not replace checking the land's title.",
        ],
      },
      {
        type: "p",
        text: "If a Bhavano listing shows a RERA number, still check it on the state's website. We do not verify it for you, as explained on our [Trust and Safety page](/trust). Browse [apartments for sale](/buy/apartment), and read our guide on [ready-to-move or under-construction flats](/blog/ready-to-move-vs-under-construction) before you decide.",
      },
    ],
  },
  {
    slug: "dtcp-approved-plots-explained",
    title: "DTCP approved plots: what the approval means and how to check it",
    description:
      "What DTCP approval means for a plot or layout, why buying in an approved layout lowers your risk, and how to check an approval before you pay.",
    published: "2026-10-19",
    format: "Explainer",
    readingMinutes: 6,
    reviewedBy: [{ name: "Jayandhan Rajasundaram" }, { name: "Anitha Narayanasamy" }],
    body: [
      {
        type: "note",
        text: "This is general information, not legal advice. Which body approves layouts, and what it is called, differs by state. Confirm with the planning authority for the area and have a lawyer read the papers.",
      },
      {
        type: "p",
        text: "DTCP is the Directorate of Town and Country Planning, a state planning department. In several states, for example Tamil Nadu, Telangana and Haryana, it approves layouts and permits development, especially outside the area of a city's own development authority. In other states a different body does this job, so always ask which authority covers the plot you are looking at.",
      },
      { type: "h2", text: "What an approved layout is" },
      {
        type: "p",
        text: "A layout is a piece of land divided into plots with roads, drains and shared open spaces. An approved layout is one whose plan the authority has examined and sanctioned: the roads and plot sizes follow its rules, space is set aside for common use, and the land is permitted for residential development.",
      },
      { type: "h2", text: "Why plots in an approved layout are more credible" },
      {
        type: "ul",
        items: [
          "You can usually get permission to build a house on the plot, which is not certain on an unapproved one.",
          "Banks are more willing to lend against a plot or a house in an approved layout.",
          "Water, power and road connections are easier to arrange and are planned into the layout.",
          "Resale is easier, because the next buyer can check the same approval.",
          "You avoid the risk of notices, penalties or demolition that can follow unapproved development.",
        ],
      },
      { type: "h2", text: "How to check an approval" },
      {
        type: "ol",
        items: [
          "Ask the seller for the approved layout plan and the approval letter, with its number and date.",
          "Check that your plot number, its size and its boundaries match the plan.",
          "Confirm the approval with the planning authority's office or website, not only from the copy you were shown.",
          "Check that the land was converted for residential use where that is required, and that the roads and open spaces shown in the plan are actually there.",
          "Read the other papers in our [documents checklist](/blog/property-approvals-documents-checklist).",
        ],
      },
      { type: "h2", text: "What approval does not tell you" },
      {
        type: "p",
        text: "Approval shows the layout meets planning rules. It does not prove that the person selling the plot owns it, that the price is fair or that there is no dispute over the land. Check the title and the encumbrance certificate as well, and see our guide to [buying a plot of land](/blog/buying-a-plot-checklist).",
      },
      {
        type: "p",
        text: "Bhavano does not verify approvals or land documents; see our [Trust and Safety page](/trust). When you are ready, browse [plots for sale](/plot).",
      },
    ],
  },
  {
    slug: "bda-approved-sites-bengaluru",
    title: "BDA approved sites in Bengaluru: what the approval means for a buyer",
    description:
      "What a BDA approved layout or site is in Bengaluru, how it differs from other approvals, why it matters for building and loans, and how to check it.",
    published: "2026-10-19",
    format: "Explainer",
    readingMinutes: 6,
    reviewedBy: [{ name: "Jayandhan Rajasundaram" }, { name: "Anitha Narayanasamy" }],
    body: [
      {
        type: "note",
        text: "This is general information, not legal advice. Bengaluru's civic and planning bodies, and their names, change over time. Confirm the current position with the authority and a lawyer.",
      },
      {
        type: "p",
        text: "BDA is the Bengaluru Development Authority, the body that plans the city's growth and forms or approves layouts of residential sites. A BDA approved site is one in a layout that the authority formed itself, or that a private developer built with its sanction. In Bengaluru this is one of the first things a site buyer is asked about.",
      },
      { type: "h2", text: "Why it matters in Bengaluru" },
      {
        type: "ul",
        items: [
          "A site in a sanctioned layout usually has an approved plan, defined roads and civic spaces, and is easier to get permission to build on.",
          "It is also the usual route to an A khata, the municipal record that shows a property is fully approved. See [A khata and B khata](/blog/a-khata-b-khata-bengaluru).",
          "Banks are more comfortable lending against a site or a house in an approved layout.",
          "Sites carved out of farmland without layout approval, often sold as revenue sites, can run into trouble with building permission, loans and resale.",
        ],
      },
      { type: "h2", text: "Do not mix up the different approvals" },
      {
        type: "ul",
        items: [
          "A BDA approved layout is about the land: whether the plots are sanctioned.",
          "A sanctioned building plan is about the building you put on it, and the city's municipal authority handles that.",
          "On the edges of the city, other planning bodies can be the relevant authority instead of the BDA, so ask which one covers the site.",
        ],
      },
      { type: "h2", text: "How to check a BDA approved site" },
      {
        type: "ol",
        items: [
          "Ask for the layout approval and the approved plan, and match the site number and dimensions to it.",
          "Check the allotment letter or sale deed, and the chain of ownership behind it.",
          "Ask for the khata certificate and extract, the property tax receipts and an encumbrance certificate.",
          "Confirm with the BDA office or its official records that the layout is approved, and that the land is not caught in an acquisition or a dispute.",
          "Be careful with an advertisement that only says BDA approved. Ask for the paper and check it yourself.",
        ],
      },
      { type: "h2", text: "What it does not tell you" },
      {
        type: "p",
        text: "A layout approval does not prove the seller's title or the fairness of the price. Read our [documents checklist](/blog/property-approvals-documents-checklist) and the guide to [buying a plot](/blog/buying-a-plot-checklist). Bhavano does not verify approvals; see [how we check listings](/trust).",
      },
      {
        type: "p",
        text: "To look at what is listed, browse [Bengaluru](/bengaluru) or [plots for sale](/plot).",
      },
    ],
  },
  {
    slug: "occupancy-certificate-and-completion-certificate",
    title: "Occupancy certificate and completion certificate: why you should ask for them",
    description:
      "What a commencement, completion and occupancy certificate each prove, why an apartment without an occupancy certificate is risky, and what to ask for.",
    published: "2026-10-19",
    format: "Explainer",
    readingMinutes: 6,
    reviewedBy: [{ name: "Jayandhan Rajasundaram" }, { name: "Anitha Narayanasamy" }],
    body: [
      {
        type: "note",
        text: "This is general information, not legal advice. What these certificates are called, who issues them and how they are combined differs by state and city. Confirm with the local authority and a lawyer.",
      },
      {
        type: "p",
        text: "A new building passes through three official stages. Each one produces a paper, and each paper answers a different question. When you buy a ready-to-move flat or house, the last one matters most.",
      },
      { type: "h2", text: "The three certificates" },
      {
        type: "ul",
        items: [
          "Commencement certificate: the local authority's permission to start building under the sanctioned plan.",
          "Completion certificate: confirms that the building was built according to the sanctioned plan.",
          "Occupancy certificate: confirms the building is fit to be lived in, meaning it follows the plan and meets safety and service requirements such as fire safety and water and drainage.",
        ],
      },
      {
        type: "p",
        text: "In some places the completion and occupancy certificates are issued together or under one name. What you want to see is the authority's written confirmation that the finished building can legally be occupied.",
      },
      { type: "h2", text: "Why a building with an occupancy certificate is more credible" },
      {
        type: "ul",
        items: [
          "It is proof that the authority has inspected the building and found it matches the approved plan.",
          "Permanent water and electricity connections usually depend on it, and a builder can be asked for it by the society.",
          "Banks often ask for it before lending on a ready home, and it makes later resale easier.",
          "Without it you can face penalties, notices or refused services, and the risk can fall on the owners.",
        ],
      },
      { type: "h2", text: "What to ask for" },
      {
        type: "ol",
        items: [
          "A copy of the occupancy certificate and the completion certificate, and the sanctioned plan they refer to.",
          "Check the address, the tower or wing and the number of floors on the certificate against the one you are buying in. Some projects get partial certificates.",
          "Ask whether the building has any deviations from the plan, and how they were handled.",
          "Ask for the fire and lift clearances where they apply.",
          "For a resale, ask the seller for the original certificate from the builder.",
        ],
      },
      { type: "h2", text: "Under-construction and older buildings" },
      {
        type: "p",
        text: "An under-construction project will not have an occupancy certificate yet, which is normal. Check its approvals and its [RERA registration](/blog/rera-explained-for-home-buyers) instead, and insist that the agreement says the builder must hand over with the certificate. Some older buildings were built before today's rules or never got one, so ask the local authority and a lawyer how that affects the property.",
      },
      {
        type: "p",
        text: "Our [flat viewing checklist](/blog/flat-viewing-checklist) covers what to inspect in person, and the [documents checklist](/blog/property-approvals-documents-checklist) lists every paper to ask for. Bhavano does not verify certificates; see [Trust and Safety](/trust). Browse [apartments for sale](/buy/apartment).",
      },
    ],
  },
  {
    slug: "a-khata-b-khata-bengaluru",
    title: "A khata and B khata in Bengaluru: what they mean when you buy",
    description:
      "What a khata is, how an A khata differs from a B khata, why it matters for loans, building and resale in Bengaluru, and what a khata does not prove.",
    published: "2026-10-19",
    format: "Explainer",
    readingMinutes: 5,
    reviewedBy: [{ name: "Jayandhan Rajasundaram" }, { name: "Anitha Narayanasamy" }],
    body: [
      {
        type: "note",
        text: "This is general information, not legal advice. Khata rules, the offices that issue it and the process of converting one kind to another change. Confirm the current position with the authority and a lawyer.",
      },
      {
        type: "p",
        text: "In Bengaluru, a khata is the city authority's record of a property, used mainly to collect property tax. You will hear buyers asked whether a site or flat has an A khata or a B khata. The difference says a lot about how the property is treated by the authority, by banks and by the next buyer.",
      },
      { type: "h2", text: "A khata" },
      {
        type: "ul",
        items: [
          "Generally given to a property that stands on an approved layout and meets the authority's rules.",
          "Treated as fully legal in the authority's records.",
          "Easier to get a bank loan against, to get a building plan sanctioned for, and to resell.",
        ],
      },
      { type: "h2", text: "B khata" },
      {
        type: "ul",
        items: [
          "Generally given to properties that lack some approval, for example a site in an unapproved layout or a building with deviations.",
          "The owner can usually still pay property tax, but the property is not treated as fully approved.",
          "Banks may refuse to lend, new building permission can be hard to get, and resale is harder. Karnataka has run schemes to move some B khata properties to A khata, so ask what is possible for the one you are looking at.",
        ],
      },
      { type: "h2", text: "Why this makes an approved property more credible" },
      {
        type: "p",
        text: "A khata is a sign that the layout and the building have passed the authority's checks. That is why the questions about [BDA approved sites](/blog/bda-approved-sites-bengaluru), a sanctioned building plan and an [occupancy certificate](/blog/occupancy-certificate-and-completion-certificate) usually come together with the khata question.",
      },
      { type: "h2", text: "What a khata does not prove" },
      {
        type: "ul",
        items: [
          "It is a tax and records entry, not proof of ownership. Ownership comes from the sale deed and the chain of earlier deeds.",
          "It does not show whether the property has loans or claims against it. That is what an encumbrance certificate is for.",
          "A khata can be in someone else's name by mistake, so check the name against the sale deed.",
        ],
      },
      { type: "h2", text: "What to ask for" },
      {
        type: "ol",
        items: [
          "The khata certificate and the khata extract, and check which kind it is.",
          "The latest property tax receipts.",
          "The sale deed and an encumbrance certificate.",
          "The layout approval and, for a building, the sanctioned plan and occupancy certificate.",
        ],
      },
      {
        type: "p",
        text: "See the full list in our [documents checklist](/blog/property-approvals-documents-checklist). Bhavano does not verify khata or other documents; read [how we check listings](/trust). To see what is listed, browse [Bengaluru](/bengaluru).",
      },
    ],
  },
  {
    slug: "construction-stage-to-buy-from-builder",
    title: "Which construction stage is best to buy an apartment or villa from a builder?",
    description:
      "Pre-launch, foundation, structure, finishing or ready to move: what each stage of a builder's project offers a buyer, what it risks, and what to check at each.",
    published: "2026-10-19",
    format: "Guide",
    readingMinutes: 8,
    reviewedBy: [{ name: "Jayandhan Rajasundaram" }, { name: "Anitha Narayanasamy" }],
    body: [
      {
        type: "note",
        text: "This is general information, not financial or legal advice. Rules for builders and buyers differ by state, and every project is different. Have a lawyer read the builder's agreement before you sign or pay.",
      },
      {
        type: "p",
        text: "There is no single best stage. Buying early usually means a lower price and more choice, but a longer wait and more risk. Buying late means certainty and a home you can see, but a higher price and fewer options. The right stage depends on how soon you need the home, how much risk you can carry and how well you can check the builder.",
      },
      { type: "h2", text: "The stages of a builder's project" },
      {
        type: "ol",
        items: [
          "Pre-launch: the project is announced, often before it has all its approvals.",
          "Launch and early construction: approvals are in place and work is starting, with the site cleared and the foundation being laid.",
          "Structure under way: the frame and floors are rising, tower by tower or villa by villa.",
          "Finishing: the structure is complete and the walls, flooring, plumbing, wiring and fittings are going in.",
          "Near handover: the building is finished and waiting for its final certificates.",
          "Ready to move: the building has its occupancy certificate and you can take possession.",
        ],
      },
      { type: "h2", text: "What each stage offers, and what it risks" },
      {
        type: "h2",
        text: "Pre-launch",
      },
      {
        type: "p",
        text: "Prices and choice are at their best, but this is the riskiest point. Under the RERA law, a project above a certain size must be registered before it is advertised or sold, so be very cautious of an offer that asks for money before a registration number exists. Read [RERA explained](/blog/rera-explained-for-home-buyers).",
      },
      { type: "h2", text: "Launch and early construction" },
      {
        type: "p",
        text: "Approvals and registration should now be in place, so you can check them. You still wait a long time, the project can slip, and the builder's later finances matter. This stage suits buyers who can wait, who have a safety margin and who have checked the builder's earlier projects.",
      },
      { type: "h2", text: "Structure under way" },
      {
        type: "p",
        text: "Many cautious buyers prefer this middle ground. You can see real progress on site and compare it with the timeline the builder filed, and you still have time to pay in stages. Risk is lower than at the start, though delays in finishing and in getting certificates are still possible.",
      },
      { type: "h2", text: "Finishing, and near handover" },
      {
        type: "p",
        text: "Uncertainty about whether the project will be built has mostly gone. Now the questions are quality and timing: whether the finishing matches what was promised, and when the final certificates will arrive. Inspect the actual unit, or a finished sample, and ask when the occupancy certificate is expected.",
      },
      { type: "h2", text: "Ready to move" },
      {
        type: "p",
        text: "You can see exactly what you are buying, move in or rent it out soon, and check the [occupancy certificate](/blog/occupancy-certificate-and-completion-certificate) before you pay. The price is usually higher and the best units may be gone. For many families this is the lowest-stress choice.",
      },
      { type: "h2", text: "Apartment or villa: what changes" },
      {
        type: "ul",
        items: [
          "Apartment: you buy a unit and a share of the land. Progress is tower by tower, so check the stage of your own tower, not just the project. A big project may get certificates for some towers first, and shared facilities such as a clubhouse often finish last.",
          "Villa: you are often buying a plot and a house together, sometimes under two agreements. Check the layout approval and what has been built on your own plot, because villas in one community are frequently built in phases. Promised roads, drains and shared facilities can lag behind the homes.",
          "Villa customisation: an early stage may let you choose the layout or fittings. Get every change in writing, with its price and its effect on the delivery date.",
        ],
      },
      { type: "h2", text: "Who should buy at which stage" },
      {
        type: "ul",
        items: [
          "You need a home soon, or want the least risk: ready to move, or finished and awaiting its final certificate.",
          "You can wait and want to spread the payments: structure under way, in a registered project by a builder with a record of on-time delivery.",
          "You want the best price and choice and accept real risk: an early stage, only with registration and approvals in place, a builder you have checked, and money to spare if delivery is late.",
        ],
      },
      { type: "h2", text: "Checks that apply at every stage" },
      {
        type: "ol",
        items: [
          "Get the RERA registration number and check the project's page on the state authority's site, comparing its stated completion date and progress with what you were told.",
          "Check the approvals, using our [documents checklist](/blog/property-approvals-documents-checklist).",
          "Visit completed projects by the same builder and talk to the residents about delays and after-sales service.",
          "Prefer a payment schedule tied to construction progress rather than to dates, and read what the agreement says happens if the builder is late.",
          "If you borrow, ask the bank how it releases the loan. It usually pays out in stages as work progresses, and you pay interest on what has been released. See our [EMI guide](/blog/home-loan-emi-explained).",
          "Visit the site yourself and take dated photographs, then compare them with the stage the builder claims.",
        ],
      },
      {
        type: "p",
        text: "Bhavano does not verify builders' approvals or progress, as explained on our [Trust and Safety page](/trust). To compare the options, browse [apartments for sale](/buy/apartment) and [villas for sale](/buy/villa), and read our shorter guide on [ready-to-move and under-construction flats](/blog/ready-to-move-vs-under-construction).",
      },
    ],
  },
  {
    slug: "how-to-sell-property-online-in-india",
    title: "How to sell property online in India: a complete guide for owners",
    description:
      "Sell a flat, house, villa, plot or shop online without a middleman: prepare, price, list, handle buyers and close the sale, with how Bhavano helps at each step.",
    published: "2026-10-20",
    format: "Guide",
    readingMinutes: 8,
    body: [
      {
        type: "note",
        text: "General information, not legal or financial advice. Sale rules, stamp duty and taxes differ by state and by property. Have a lawyer check the sale agreement and the title before you sign.",
      },
      {
        type: "p",
        text: "More owners now find their buyer online than through a broker or a signboard. A good online listing reaches people searching in your city and area at the moment they are ready to look, and it lets you reply to them directly. The sale itself still needs careful paperwork. This guide covers the whole path, and shows where Bhavano fits at each step.",
      },
      { type: "h2", text: "Step 1: Get your documents ready first" },
      {
        type: "p",
        text: "Serious buyers and their banks ask for papers early. A seller who has them ready sells faster and negotiates from a stronger position.",
      },
      {
        type: "ul",
        items: [
          "Title papers: the sale deed or allotment letter and the chain of earlier documents.",
          "Latest property tax receipts, electricity and water bills, and society or maintenance dues clearance.",
          "Approvals: building plan, completion or occupancy certificate, and for plots the layout approval. Our [documents checklist](/blog/property-approvals-documents-checklist) explains each.",
          "If there is a home loan, ask your lender what it needs to release the original papers when you sell.",
        ],
      },
      { type: "h2", text: "Step 2: Decide your price with evidence" },
      {
        type: "p",
        text: "Do not guess, and do not copy the highest number you see. Browse [apartments for sale](/buy/apartment) or [houses for sale](/buy/house) in your locality, of the same type, size and age, and see what owners are asking. Leave some room to negotiate, and decide in advance the lowest price you would accept.",
      },
      {
        type: "p",
        text: "Be clear about which area you are quoting. Buyers compare on carpet area, built-up area or super built-up area, and a mismatch causes arguments later. See [carpet, built-up and super built-up area](/blog/carpet-built-up-super-built-up-area).",
      },
      { type: "h2", text: "Step 3: Create a listing that earns enquiries" },
      {
        type: "p",
        text: "Your listing is your shop window. Most buyers decide in seconds whether to open it or scroll on.",
      },
      {
        type: "ul",
        items: [
          "Use bright, straight photos of every room, the kitchen, bathrooms, balcony, building entrance and parking. Add a short video walk-through if you can.",
          "Write a plain title with the type, size, locality and city.",
          "Describe floor, facing, age, furnishing, parking, maintenance and what is included in the sale.",
          "Pin the exact location on the map so buyers can judge the commute and the neighbourhood.",
          "Be honest. A buyer who finds a surprise at the visit leaves, and tells others.",
        ],
      },
      {
        type: "p",
        text: "Our guide to [writing a listing that gets enquiries](/blog/write-a-property-listing-that-gets-enquiries) goes deeper on wording and photos.",
      },
      { type: "h2", text: "Step 4: Post it where buyers are searching" },
      {
        type: "p",
        text: "Buyers on Bhavano search by city, area, category and budget, so a complete listing in the right category and area is shown to the right people. You post from your phone or computer in a few steps: choose that you are selling, pick the category (apartment, house, villa, plot or commercial), add the details and photos, set your price and publish.",
      },
      {
        type: "p",
        text: "Bhavano is built so owners can deal with buyers directly, without a broker in between. [Post your property on Bhavano](/post) to start.",
      },
      { type: "h2", text: "Step 5: Reach more buyers" },
      {
        type: "ul",
        items: [
          "Share your listing link on WhatsApp with friends, family, your housing society group and colleagues. You can also create a poster of your ad with a QR code that sends people straight to it.",
          "Keep the listing fresh. Update the price if you change it, and mark it closed once the property is sold so you do not get calls you cannot use.",
          "Consider a Featured listing if you want more visibility. Featured ads get a gold badge, higher placement in relevant results, alerts when someone shows interest, and a daily recap of views and messages. It is optional, and a normal listing works without it.",
        ],
      },
      { type: "h2", text: "Step 6: Handle enquiries and visits safely" },
      {
        type: "ul",
        items: [
          "Reply quickly. Buyers who wait a day often move on to the next listing.",
          "Use in-app messages for the first conversation and share your number only when you are comfortable.",
          "Hold visits at the property, in daylight where possible, and let a family member know when a stranger is visiting.",
          "Do not pay anything to receive an offer. A buyer who wants to send an advance before seeing the property, or anyone asking you for a processing fee, is a warning sign. See [spotting a bad property ad or a scam](/blog/spotting-a-bad-property-ad).",
          "Ask buyers about their financing early. A buyer with an approved home loan or ready funds is more likely to close. Buyers can check their budget with our [home loan eligibility](/tools/home-loan-eligibility-calculator) and [EMI](/tools/emi-calculator) calculators.",
        ],
      },
      { type: "h2", text: "Step 7: Negotiate, agree and complete the sale" },
      {
        type: "ol",
        items: [
          "Agree the price, the token amount, the payment schedule and the possession date in writing.",
          "Sign an agreement to sell prepared or reviewed by a lawyer.",
          "Clear any existing loan and get the original papers back from the lender.",
          "Complete the sale deed and registration at the sub-registrar's office, paying the stamp duty and registration charges your state requires.",
          "Hand over possession, keys and utility transfers, and keep copies of every document and receipt.",
          "Ask your tax adviser about any tax on the sale and any reporting it needs.",
        ],
      },
      { type: "h2", text: "What Bhavano does and does not do" },
      {
        type: "p",
        text: "Bhavano gives you a place to list, get found and talk to buyers directly. We do not verify ownership, documents or approvals, and we do not take part in the sale or in the payment between you and the buyer. How we handle this is explained on our [Trust and Safety page](/trust). Treat every buyer and every document with the same care you would offline.",
      },
      { type: "h2", text: "A short checklist" },
      {
        type: "ul",
        items: [
          "Documents collected, and names matched across them.",
          "Price set after comparing similar listings.",
          "Photos taken in daylight, with a full description and map pin.",
          "Listing live in the right category and area.",
          "Link shared on WhatsApp and in your society group.",
          "Enquiries answered within a few hours.",
          "A lawyer engaged before you sign the agreement.",
        ],
      },
      {
        type: "p",
        text: "Ready? [Post your property on Bhavano](/post). Selling a plot? Read our [plot checklist](/blog/buying-a-plot-checklist) to see what buyers will ask you. For a shorter overview, see [how to sell your house or flat online](/blog/how-to-sell-your-house-or-flat-online). Selling in order to move? Our [guide to moving to a new city](/moving-to-a-new-city) may help.",
      },
    ],
  },
  {
    slug: "what-does-bhk-mean",
    title: "What does 1 BHK, 2 BHK and 3 BHK mean? A plain answer",
    description:
      "BHK means bedroom, hall and kitchen. What 1 BHK, 2 BHK, 3 BHK, 1 RK and studio mean, what is not counted, and how to compare homes of the same BHK.",
    published: "2026-10-21",
    format: "Explainer",
    readingMinutes: 4,
    body: [
      {
        type: "p",
        text: "BHK stands for bedroom, hall and kitchen. The number in front is the number of bedrooms. So a 2 BHK home has two bedrooms, one hall (the living room) and one kitchen, usually with at least one bathroom.",
      },
      { type: "h2", text: "What do 1 BHK, 2 BHK and 3 BHK mean?" },
      {
        type: "ul",
        items: [
          "1 BHK: one bedroom, a living room and a kitchen. Common for singles and couples.",
          "2 BHK: two bedrooms, a living room and a kitchen. The most searched size for small families.",
          "3 BHK: three bedrooms, a living room and a kitchen. Suits larger families or people who want a home office or guest room.",
          "4 BHK and above: four or more bedrooms, mostly in villas and larger apartments.",
        ],
      },
      { type: "h2", text: "What does 1 RK mean, and what is a studio?" },
      {
        type: "p",
        text: "RK means room and kitchen. A 1 RK has one room that serves as both bedroom and living space, with a separate kitchen. A studio flat has a single open space that holds the bed, sitting area and kitchen counter, usually with a separate bathroom.",
      },
      { type: "h2", text: "What is not counted in a BHK?" },
      {
        type: "p",
        text: "Bathrooms, balconies, a utility area, a store room, a pooja room and a dining area are not counted in the BHK number. Some sellers add words like 2.5 BHK or 2 BHK plus study to describe an extra small room. Ask to see it, and check whether it is a real room with a window and a door.",
      },
      { type: "h2", text: "Does the same BHK mean the same size?" },
      {
        type: "p",
        text: "No. Two flats can both be 2 BHK and differ a lot in size, because the number only counts rooms. Compare the area in square feet, and make sure both are quoted the same way. Carpet area is what you can actually use, while built-up and super built-up area include walls and shared spaces. Our guide to [carpet, built-up and super built-up area](/blog/carpet-built-up-super-built-up-area) explains the difference, and the [area unit converter](/tools/area-unit-converter) helps when sizes are given in different units.",
      },
      { type: "h2", text: "How do I pick the right BHK?" },
      {
        type: "ol",
        items: [
          "Count the people who will live there, and whether anyone needs a work-from-home space.",
          "Decide whether you are renting or buying. A larger home costs more to rent, to maintain and to furnish.",
          "Check the floor plan, not just the BHK label: where the doors, windows and bathrooms are matters as much as the room count.",
          "Look at several homes of your chosen size in the same area before deciding.",
        ],
      },
      {
        type: "p",
        text: "Ready to look? Browse [apartments for rent](/rent-lease/apartment) or [apartments for sale](/buy/apartment) and filter by BHK on Bhavano.",
      },
    ],
  },
  {
    slug: "real-estate-terms-explained-india",
    title: "Indian property terms explained: a plain-language glossary",
    description:
      "Plain answers to common property words in India: furnishing, token amount, lock-in, security deposit, possession, carpet area, khata, RERA and more.",
    published: "2026-10-21",
    format: "Glossary",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. Terms and rules differ by state and by agreement. Read your own documents and ask a lawyer when money or ownership is at stake.",
      },
      {
        type: "p",
        text: "Property ads are full of short words that assume you already know them. This glossary gives a plain answer to each, so you can read a listing or an agreement with confidence.",
      },
      { type: "h2", text: "Words you see on rental listings" },
      {
        type: "ul",
        items: [
          "Unfurnished: no furniture or appliances, though lights, fans and kitchen fittings may be there. Ask what is included.",
          "Semi-furnished: some items such as wardrobes, a modular kitchen, lights and fans, but usually no bed or sofa. There is no fixed list, so ask for it in writing.",
          "Fully furnished: ready to live in, with beds, sofa, wardrobes and usually appliances such as a fridge and washing machine. Check what works before you move in.",
          "Security deposit: money you pay at the start and get back at the end, less any agreed deductions. See [how a security deposit works](/blog/security-deposit-for-rent-in-india).",
          "Lock-in period: a minimum time you agree to stay (or the owner agrees to let you stay). Leaving early may cost you a penalty.",
          "Notice period: how long before leaving you must tell the owner in writing.",
          "Maintenance: the monthly society charge for common areas. Ask whether it is included in the rent or paid by you on top. See [society maintenance charges explained](/blog/society-maintenance-charges-explained).",
        ],
      },
      { type: "h2", text: "Words you see on sale listings" },
      {
        type: "ul",
        items: [
          "Ready to move: the building is complete and you can take possession now. Compare with under-construction in [ready to move vs under construction](/blog/ready-to-move-vs-under-construction).",
          "Possession: the date the owner hands over the property to you.",
          "Resale: a property being sold by its current owner, not a builder selling a new one.",
          "Token amount: a small advance paid to hold a property while the paperwork is prepared. Pay it only to a verified owner, against a written receipt. See [how to verify an owner before you pay](/blog/verify-property-owner-before-paying-token).",
          "Carpet area, built-up area, super built-up area: three ways of measuring size. See [what each one means](/blog/carpet-built-up-super-built-up-area).",
          "Freehold and leasehold: whether you own the land outright or for a fixed term. See [freehold vs leasehold](/blog/freehold-vs-leasehold-property-india).",
        ],
      },
      { type: "h2", text: "Words about approvals and papers" },
      {
        type: "ul",
        items: [
          "Sale deed: the registered document that transfers ownership from seller to buyer.",
          "Khata: a local-authority record of a property used for tax. In Bengaluru, see [A khata and B khata](/blog/a-khata-b-khata-bengaluru).",
          "Occupancy certificate: proof from the local authority that a building was completed as approved and is fit to live in. See [occupancy and completion certificates](/blog/occupancy-certificate-and-completion-certificate).",
          "RERA: the real estate regulator's registration for projects. See [RERA explained](/blog/rera-explained-for-home-buyers).",
          "Encumbrance: a claim on the property, such as a loan or a dispute. An encumbrance certificate lists registered claims.",
        ],
      },
      {
        type: "p",
        text: "For a full list of documents to ask for, read the [approvals and documents checklist](/blog/property-approvals-documents-checklist). For what the word BHK means, see [what BHK means](/blog/what-does-bhk-mean).",
      },
    ],
  },
  {
    slug: "security-deposit-for-rent-in-india",
    title: "Security deposit for rent in India: how it works and how to get it back",
    description:
      "What a rental security deposit is, how much is usual, when it is returned, what can be deducted, and what to put in writing so you get it back.",
    published: "2026-10-21",
    format: "Guide",
    readingMinutes: 5,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. Deposit amounts and rules differ by city, by state and by agreement. Read your own rental agreement carefully.",
      },
      {
        type: "p",
        text: "A security deposit is money a tenant pays the owner at the start of a tenancy. It is held as protection against unpaid rent or damage, and it is meant to come back when the tenancy ends, less any deductions the agreement allows. It is not rent, and it is not a fee.",
      },
      { type: "h2", text: "How much is a security deposit?" },
      {
        type: "p",
        text: "There is no single amount for the whole country. It is usually set as a number of months of rent, and the customary number differs between cities, and even between neighbourhoods. Some cities have a norm of a few months, while others expect much more. Ask the owner, compare with similar homes in [apartments for rent](/rent-lease/apartment) in the same area, and negotiate before you sign, not after.",
      },
      { type: "h2", text: "Is the deposit refundable, and when?" },
      {
        type: "p",
        text: "Yes, the deposit is meant to be refundable. The agreement should say when it is returned: usually on the day you hand back the keys, or within a fixed number of days afterwards. If the agreement is silent, you are relying on goodwill, so get a date written down.",
      },
      { type: "h2", text: "What can an owner deduct?" },
      {
        type: "ul",
        items: [
          "Unpaid rent or unpaid utility bills.",
          "Repairs for damage beyond normal wear and tear.",
          "Any items missing from the inventory you both signed.",
          "Painting or cleaning charges, only if the agreement says so.",
        ],
      },
      {
        type: "p",
        text: "Normal wear and tear, such as faded paint or small marks from everyday use, is generally not damage. Agree on that wording at the start.",
      },
      { type: "h2", text: "How do I protect my deposit?" },
      {
        type: "ol",
        items: [
          "Pay by bank transfer or UPI, not cash, and keep the receipt.",
          "Put the amount, the refund date and the allowed deductions in the written agreement. See [rental agreement questions](/blog/rental-agreement-questions).",
          "Take dated photos or a video of every room on the day you move in, and share them with the owner.",
          "Sign an inventory list for any furniture and appliances.",
          "Give notice in writing and keep a copy, within the notice period.",
          "On the day you leave, do a joint walk-through and note the condition together.",
        ],
      },
      { type: "h2", text: "What if the deposit is not returned?" },
      {
        type: "p",
        text: "Start by asking in writing and keeping the message. Many disputes end there. If the owner still refuses, a lawyer or your local consumer or rent authority can advise on the next step for your state. Keeping the agreement, the payment proof and your move-in photos makes any dispute far easier.",
      },
      {
        type: "p",
        text: "Looking for a rental? Read our [flat viewing checklist](/blog/flat-viewing-checklist) and the [rent affordability calculator](/tools/rent-affordability-calculator) before you shortlist.",
      },
    ],
  },
  {
    slug: "verify-property-owner-before-paying-token",
    title: "How to verify a property owner before you pay a token amount",
    description:
      "Before paying any advance for a flat or house, check that the person is the real owner or an authorised agent. A step-by-step list of what to ask and see.",
    published: "2026-10-21",
    format: "Checklist",
    readingMinutes: 5,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. For a purchase, have a lawyer check the title before you pay a significant amount.",
      },
      {
        type: "p",
        text: "Check three things before you pay any advance: that the person you are dealing with really owns the property or is authorised to act for the owner, that the property can legally be let or sold, and that you get a written receipt for what you pay. Pay nothing to anyone who rushes you or who will not let you see the property and the papers.",
      },
      { type: "h2", text: "How do I know the person is the owner?" },
      {
        type: "ol",
        items: [
          "Ask to see a government photo ID, and match the name to the ownership papers.",
          "For a purchase, ask for the sale deed or allotment letter, and the latest property tax receipt in the same name.",
          "For a rental, ask for the same papers, or the latest electricity or water bill, and compare the name.",
          "Meet at the property. Be cautious of anyone who is always unreachable, or who only wants to talk by message.",
          "If a broker or relative is dealing for the owner, ask for a written authorisation and speak to the owner yourself.",
        ],
      },
      { type: "h2", text: "What are the warning signs?" },
      {
        type: "ul",
        items: [
          "The rent or price is far below similar homes nearby. See [how to spot a bad property ad](/blog/spotting-a-bad-property-ad).",
          "You are asked to pay before seeing the property, or to pay to 'hold' it the same day.",
          "The owner is 'abroad' or 'in the army' and asks you to send money to receive keys.",
          "The photos do not match the building or the neighbourhood.",
          "They will not put anything in writing, or the name on the papers keeps changing.",
        ],
      },
      { type: "h2", text: "How should I pay the token amount?" },
      {
        type: "ul",
        items: [
          "Pay by bank transfer or UPI to an account in the owner's name, not cash and not to a third person.",
          "Get a signed receipt that states the amount, the date, the property address and what the amount is for.",
          "Write down whether the token is refundable, and under what conditions, before you pay.",
          "For a purchase, ask your lawyer to review the token or agreement-to-sell paper first.",
        ],
      },
      { type: "h2", text: "What does Bhavano verify?" },
      {
        type: "p",
        text: "Bhavano shows whether a listing is posted by an owner or an agent, and lets you message the poster. We do not inspect properties or check ownership papers for you, so the checks above are still yours to do. Our [trust page](/trust) explains what we do and do not verify.",
      },
      {
        type: "p",
        text: "Visiting soon? Use the [flat viewing checklist](/blog/flat-viewing-checklist), and read the [documents checklist](/blog/property-approvals-documents-checklist) before you buy.",
      },
    ],
  },
  {
    slug: "freehold-vs-leasehold-property-india",
    title: "Freehold vs leasehold property in India: what is the difference?",
    description:
      "Freehold means you own the property and the land outright. Leasehold means you hold it for a fixed term. How each affects selling, loans and renewal.",
    published: "2026-10-21",
    format: "Explainer",
    readingMinutes: 5,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. Land and lease rules differ by state and by authority. Have a lawyer read the title and any lease before you buy.",
      },
      {
        type: "p",
        text: "Freehold means you own the property and the land under it outright, with no time limit. Leasehold means the land belongs to another party, often a development authority or a government body, and you hold the right to use it for a fixed number of years under a lease. Both can be good buys, but they come with different rights and different checks.",
      },
      { type: "h2", text: "What is a freehold property?" },
      {
        type: "p",
        text: "With freehold, ownership passes to you in full on registration. You can usually sell, gift or leave the property to your heirs without anyone else's permission, subject to ordinary local rules. Most standalone houses and many apartments in private layouts are freehold.",
      },
      { type: "h2", text: "What is a leasehold property?" },
      {
        type: "p",
        text: "With leasehold, you own the building or the right to use the property, but the land is leased to you for a stated term. In some cities, plots and flats allotted by an authority are leasehold at first. The lease may later be converted to freehold on payment of charges, if the authority allows it. The terms are set by the lease deed, so the deed matters more than the label.",
      },
      { type: "h2", text: "How do they differ?" },
      {
        type: "ul",
        items: [
          "Ownership: freehold covers land and building; leasehold covers a right for a fixed term over land that belongs to someone else.",
          "Selling: a freehold owner usually sells freely. A leasehold seller may need the lessor's permission or have to pay a transfer charge.",
          "Loans: some lenders are cautious about leasehold, especially when little of the term remains. Ask your bank early.",
          "Renewal and conversion: leasehold may need renewal, and conversion to freehold depends on the authority's current policy.",
          "Resale: buyers often prefer freehold, so check how easy a leasehold property would be to sell later.",
        ],
      },
      { type: "h2", text: "What should I check before buying a leasehold property?" },
      {
        type: "ol",
        items: [
          "Read the lease deed: the term, what remains of it, any ground rent, and any limits on use or transfer.",
          "Ask the authority what it needs for transfer and whether conversion to freehold is open.",
          "Confirm that any charges due to the authority are paid, with a clearance in writing.",
          "Check the approvals, as for any property. See the [documents checklist](/blog/property-approvals-documents-checklist).",
          "Ask your lender whether it will fund a leasehold property of that age and term.",
        ],
      },
      {
        type: "p",
        text: "Comparing options? See [apartments for sale](/buy/apartment), [houses for sale](/buy/house) and [plots](/plot) on Bhavano, and ask each seller whether the title is freehold or leasehold before you visit. If you are buying land, read the [plot buying checklist](/blog/buying-a-plot-checklist) too.",
      },
    ],
  },
  {
    slug: "society-maintenance-charges-explained",
    title: "Society maintenance charges explained: what you pay and what it covers",
    description:
      "What apartment maintenance charges cover, who pays them, what a sinking fund and corpus fund are, and what to ask before you rent or buy in a society.",
    published: "2026-10-21",
    format: "Explainer",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "Maintenance charges are a regular payment, usually monthly, that residents of an apartment complex or gated society make to run and repair the shared parts of the property. The amount and what it covers are set by the society, so they differ from one complex to the next. Always ask before you rent or buy.",
      },
      { type: "h2", text: "What do maintenance charges cover?" },
      {
        type: "ul",
        items: [
          "Security staff and the gate.",
          "Cleaning and upkeep of staircases, corridors and the compound.",
          "Lift operation and repairs.",
          "Electricity for common areas and water pumps.",
          "Gardening and the upkeep of shared facilities such as a gym, clubhouse or play area.",
          "Common insurance, repairs and the society's day-to-day expenses.",
        ],
      },
      { type: "h2", text: "What are a sinking fund and a corpus fund?" },
      {
        type: "p",
        text: "A sinking fund is money set aside regularly for big future repairs, such as repainting the building or replacing a lift or a water tank. A corpus fund is usually a one-time payment made by a new buyer when joining, held as a reserve. Neither is a monthly running cost, and both are usually paid by the owner, not a tenant. Ask the society which funds exist and what each is used for.",
      },
      { type: "h2", text: "Who pays: the owner or the tenant?" },
      {
        type: "p",
        text: "There is no universal rule. In many rentals the tenant pays the monthly maintenance on top of rent, while in others the owner pays it, or it is included in a single figure. Large one-off payments, like a sinking fund or a special repair levy, are usually the owner's. Settle this before you sign, and put it in the agreement. See [rental agreement questions](/blog/rental-agreement-questions).",
      },
      { type: "h2", text: "What should I ask before renting or buying?" },
      {
        type: "ol",
        items: [
          "How much is the maintenance, how is it calculated (per flat or by area), and how often is it paid?",
          "Is it included in the rent, or paid separately?",
          "What does it cover, and what are the extra charges (parking, club, water)?",
          "Are there any unpaid dues on this flat? For a purchase, get a no-dues letter from the society.",
          "Is the society registered, and is there a residents' association that holds regular meetings?",
          "Are any big repairs or a levy planned?",
        ],
      },
      {
        type: "p",
        text: "Maintenance is part of the real monthly cost of a home, so include it when you compare. Use the [rent affordability calculator](/tools/rent-affordability-calculator) or the [rent vs buy calculator](/tools/rent-vs-buy-calculator), then browse [apartments for rent](/rent-lease/apartment) or [apartments for sale](/buy/apartment). Our [flat viewing checklist](/blog/flat-viewing-checklist) lists what to look at on the visit.",
      },
    ],
  },
  {
    slug: "down-payment-for-a-home-loan",
    title: "How much down payment do you need for a home loan in India?",
    description:
      "A lender finances only part of a home's value and you pay the rest. How the loan-to-value limit works, what else to budget for, and how down payment changes your EMI.",
    published: "2026-10-21",
    format: "Explainer",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "General information, not financial advice. The maximum loan a lender may give, and the charges you pay, are set by the central bank and by each lender, and they change. Ask your lender for the current figures. Every number below is an illustration, not a quote.",
      },
      { type: "h2", text: "How much down payment do I need?" },
      {
        type: "p",
        text: "You need to pay the part of the price that the lender will not finance, plus the one-time costs of buying. A lender lends only up to a share of the property's value, called the loan-to-value ratio, and the central bank caps that share. The cap is lower for higher-priced homes, so a more expensive home needs a larger down payment as a share of the price. Ask your lender what it will finance for the home you want.",
      },
      { type: "h2", text: "What is the loan-to-value (LTV) ratio?" },
      {
        type: "p",
        text: "Loan-to-value is the loan amount divided by the value of the property, shown as a share. If a lender finances four-fifths of a home's value, its LTV is four-fifths and you pay the remaining one-fifth yourself. The value used is usually the lower of the price you agree and the lender's own valuation, so a low valuation can raise your down payment.",
      },
      { type: "h2", text: "What does the down payment have to cover?" },
      {
        type: "ul",
        items: [
          "The part of the price the lender does not finance.",
          "Stamp duty and registration charges. See [stamp duty and registration explained](/blog/stamp-duty-and-registration-charges-explained).",
          "Loan processing fees and any charges the lender asks for upfront.",
          "Brokerage, if a broker is involved.",
          "Society transfer, deposit or corpus fund payments in an apartment complex. See [society maintenance charges](/blog/society-maintenance-charges-explained).",
          "Moving, repairs and furnishing, which are not part of the loan.",
        ],
      },
      { type: "h2", text: "How does the down payment change my EMI?" },
      {
        type: "p",
        text: "At the same interest rate and tenure, the EMI rises and falls in direct proportion to the loan amount. Borrow twice as much and the EMI is twice as high. A bigger down payment therefore lowers the EMI, and it also lowers the total interest you pay. The formula is in [how a home loan EMI is calculated](/blog/home-loan-emi-explained).",
      },
      {
        type: "p",
        text: "Example, for illustration only. Take a home priced at 5,000,000 rupees. With a down payment of 1,000,000 the loan is 4,000,000. With a down payment of 2,000,000 the loan is 3,000,000. At the same rate and tenure, where a 2,000,000 loan has an EMI of about 17,995, the first loan has an EMI of about 35,989 and the second about 26,992. Putting 1,000,000 more down lowers the monthly payment by about 8,997.",
      },
      { type: "h2", text: "How big should my down payment be?" },
      {
        type: "ol",
        items: [
          "Start with the lender's minimum, which is the home's value less the most it will finance.",
          "Keep an emergency fund aside. Do not spend all your savings on the down payment.",
          "Check that the EMI fits comfortably in your monthly income, using the [home loan eligibility calculator](/tools/home-loan-eligibility-calculator).",
          "Try a few down payments in the [down payment calculator](/tools/down-payment-calculator) and compare the EMI each gives, using the [EMI calculator](/tools/emi-calculator).",
          "Only then decide how much to put down.",
        ],
      },
      {
        type: "p",
        text: "Browsing homes within your budget? See [apartments for sale](/buy/apartment) and [houses for sale](/buy/house) on Bhavano.",
      },
    ],
  },
  {
    slug: "how-to-check-property-title-is-clear",
    title: "How to check if a property has a clear title before you buy",
    description:
      "A clear title means the seller can legally pass full ownership to you. How a title search works, what an encumbrance certificate shows, and which documents to ask for.",
    published: "2026-10-21",
    format: "Checklist",
    readingMinutes: 7,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. Land and registration rules differ by state. Have a property lawyer check the documents before you pay a significant amount.",
      },
      { type: "h2", text: "How do I check if a property has a clear title?" },
      {
        type: "p",
        text: "A title is clear when the seller can show an unbroken chain of ownership up to themselves, and no loan, dispute or other claim stands in the way of selling. You check it by collecting the title documents, getting an encumbrance certificate for the property, confirming the records match on the ground, and having a lawyer carry out a title search and give a written opinion.",
      },
      { type: "h2", text: "What is a title search?" },
      {
        type: "p",
        text: "A title search is the review of the documents and public records showing who has owned the property and whether anyone else has a claim on it. A lawyer usually does it. They trace each transfer from an earlier owner to the present seller, look for gaps or doubtful documents, and check the registry, court and revenue records for loans, disputes or conflicting claims.",
      },
      { type: "h2", text: "What is an encumbrance certificate?" },
      {
        type: "p",
        text: "An encumbrance certificate is an official record, from the sub-registrar's office in most states, that lists registered transactions on a property for a period you choose: sales, mortgages, gifts and similar. It helps show whether the property is free of registered loans or other claims. It does not show everything. An unregistered agreement or a court case may not appear, which is why it is one check among several.",
      },
      { type: "h2", text: "Which documents should I ask the seller for?" },
      {
        type: "ul",
        items: [
          "The registered sale deed or allotment letter in the seller's name, and the earlier deeds in the chain.",
          "The encumbrance certificate for as many years back as the records allow.",
          "Property tax receipts, and the khata or other municipal record in the seller's name. See [A khata and B khata](/blog/a-khata-b-khata-bengaluru) for one example.",
          "The approved building plan and the completion or occupancy certificate. See [occupancy and completion certificates](/blog/occupancy-certificate-and-completion-certificate).",
          "For a plot, the layout approval. See [buying a plot checklist](/blog/buying-a-plot-checklist).",
          "Electricity and water bills, and a society no-dues letter for an apartment.",
          "If the seller has a loan on it, the lender's statement and a written plan for releasing the original documents at sale.",
          "If someone else is selling for the owner, the registered power of attorney, and proof that the owner is alive and agrees.",
          "For a project, the RERA registration. See [how to verify a builder's RERA registration](/blog/rera-explained-for-home-buyers).",
        ],
      },
      { type: "h2", text: "What checks should I do beyond the papers?" },
      {
        type: "ol",
        items: [
          "Visit the property and confirm who is actually in possession. A tenant or occupant may have rights.",
          "Match the boundaries and area in the documents to what you see on site.",
          "Ask neighbours and the society office whether there are disputes.",
          "Have your lawyer search court records for cases involving the property or the seller.",
          "Ask your lawyer to publish a public notice inviting objections, if they advise it.",
          "Check that all co-owners or legal heirs are signing the sale.",
        ],
      },
      { type: "h2", text: "What are the warning signs?" },
      {
        type: "ul",
        items: [
          "The seller cannot show the original documents, or says they are with a bank without proof.",
          "The names on the papers do not match, or the chain has a missing step.",
          "The price is far below similar homes, and the seller is in a hurry.",
          "A co-owner or heir is absent from the sale.",
          "The seller will not let your lawyer see the documents.",
        ],
      },
      {
        type: "p",
        text: "For the full set of approvals to ask for, read the [documents checklist](/blog/property-approvals-documents-checklist). Before paying any advance, read [how to verify an owner](/blog/verify-property-owner-before-paying-token), and see our [trust page](/trust) for what Bhavano does and does not verify.",
      },
    ],
  },
  {
    slug: "how-to-calculate-rental-yield",
    title: "How to calculate rental yield on a property: gross and net, with an example",
    description:
      "Rental yield compares a property's yearly rent with its cost. The gross and net yield formulas, a worked example, and what the figure leaves out.",
    published: "2026-10-21",
    format: "Explainer",
    readingMinutes: 5,
    body: [
      {
        type: "note",
        text: "General information, not financial or tax advice. The numbers in the example are made up to show the method and are not market figures.",
      },
      { type: "h2", text: "How do I calculate rental yield?" },
      {
        type: "p",
        text: "Divide a year's rent by what the property cost, and express it as a share. That is the gross yield. For a fuller picture, take off the yearly costs of owning it and divide by the total you spent buying it. That is the net yield.",
      },
      { type: "h2", text: "What is the formula for gross rental yield?" },
      {
        type: "p",
        text: "Gross rental yield = (monthly rent x 12) / property price x 100. It ignores every cost, so it flatters the property, but it is the quickest way to compare two homes.",
      },
      { type: "h2", text: "What is the formula for net rental yield?" },
      {
        type: "p",
        text: "Net rental yield = (yearly rent - yearly costs) / (property price + buying costs) x 100.",
      },
      {
        type: "ul",
        items: [
          "Yearly costs: property tax, society maintenance paid by the owner, repairs, insurance, agent fees, and rent lost while the home is empty between tenants.",
          "Buying costs: stamp duty, registration, brokerage and any fitting-out. See [stamp duty and registration explained](/blog/stamp-duty-and-registration-charges-explained).",
        ],
      },
      { type: "h2", text: "What does a worked example look like?" },
      {
        type: "p",
        text: "Illustration only. A flat is priced at 5,000,000 rupees and rents for 20,000 a month. Yearly rent is 240,000. Gross yield is 240,000 / 5,000,000 = 4.8 per cent.",
      },
      {
        type: "p",
        text: "Now the costs. Say the owner pays 6,000 property tax, 36,000 maintenance, 10,000 repairs and loses one month of rent (20,000) to a vacancy. That is 72,000, leaving 168,000. Buying costs of 350,000 bring the total spent to 5,350,000. Net yield is 168,000 / 5,350,000 = about 3.14 per cent. The net figure is well below the gross one, which is normal.",
      },
      { type: "h2", text: "What does rental yield leave out?" },
      {
        type: "ul",
        items: [
          "Price growth. A property can gain or lose value, and yield counts only the rent.",
          "Loan interest. If you borrowed to buy, your return depends on the loan's cost. See [how a home loan EMI works](/blog/home-loan-emi-explained).",
          "Tax on rent and on a later sale.",
          "The effort and risk of finding and keeping a good tenant. See [how to find reliable tenants](/blog/how-to-find-reliable-tenants).",
        ],
      },
      { type: "h2", text: "How do I use yield to compare properties?" },
      {
        type: "ol",
        items: [
          "Look up what similar homes in the same area rent for, in [apartments for rent](/rent-lease/apartment), and what they sell for in [apartments for sale](/buy/apartment).",
          "Calculate gross yield for each, then net yield for the finalists.",
          "Compare the result with the cost of a loan and with other places you could put the money.",
          "Do not choose on yield alone: location, building quality and demand decide whether the home stays let.",
        ],
      },
      {
        type: "p",
        text: "Thinking of owning versus renting for yourself? See [rent or buy: the break-even rate](/blog/rent-or-buy-questions) and the [rent vs buy calculator](/tools/rent-vs-buy-calculator).",
      },
    ],
  },
  {
    slug: "stamp-duty-and-registration-charges-explained",
    title: "Stamp duty and registration charges on property in India: who pays and what decides them",
    description:
      "What stamp duty and registration charges are, who normally pays, why they differ by state, and how to find the exact amount for your property.",
    published: "2026-10-21",
    format: "Explainer",
    readingMinutes: 5,
    body: [
      {
        type: "note",
        text: "General information, not legal or tax advice. Rates, concessions and rules are set by each state and change often. This page deliberately does not list rates. Always confirm the current figure with the state registration department or your lawyer.",
      },
      { type: "h2", text: "What are stamp duty and registration charges?" },
      {
        type: "p",
        text: "Stamp duty is a tax the state government charges when a property changes hands or is leased on a registered document. Registration charges are a separate fee for recording the document at the sub-registrar's office. Together they make the transfer legally recognised, so they are a must-pay cost of buying, over and above the price.",
      },
      { type: "h2", text: "Who pays stamp duty and registration?" },
      {
        type: "p",
        text: "In a sale, the buyer normally pays both. This is the usual practice, and it can be agreed differently in the contract. In a rental, the duty on the rent agreement is usually split or paid as the agreement says, so write it down. See [rental agreement questions](/blog/rental-agreement-questions).",
      },
      { type: "h2", text: "Why does stamp duty differ from state to state?" },
      {
        type: "p",
        text: "Land and registration are state subjects, so each state sets its own rates and rules. Within a state, the amount can also depend on several things.",
      },
      {
        type: "ul",
        items: [
          "The state and sometimes the city or local body the property is in.",
          "The value used for duty, which is often the higher of the price you agreed and the government's own guideline or circle value for the area.",
          "The type of property: residential, commercial, agricultural land or a plot.",
          "Whether the property is ready or under construction, and whether it is a sale, a gift or a lease.",
          "Concessions that some states give to certain buyers, such as women, or for affordable homes.",
          "Other surcharges collected along with the duty, such as local body cess.",
        ],
      },
      { type: "h2", text: "How do I find the exact amount for my property?" },
      {
        type: "ol",
        items: [
          "Find the guideline or circle value of the area on the state registration department's website, or ask the sub-registrar's office.",
          "Compare it with the price in your agreement. Duty is usually charged on the higher figure.",
          "Look up the current duty and registration rates for your state and property type on the same official site.",
          "Ask your lawyer or the builder to confirm the total before you sign, and note any concession you qualify for.",
          "Keep the duty and registration inside your budget from the start. See [how much down payment you need](/blog/down-payment-for-a-home-loan).",
        ],
      },
      { type: "h2", text: "Can I avoid or reduce stamp duty?" },
      {
        type: "p",
        text: "You can claim concessions the state offers, and you should pay the duty on the correct value. Under-stating the price to pay less duty is illegal and can put your ownership and your loan at risk. Pay the right amount and keep the receipts. They are part of your proof of title. See [how to check a property has a clear title](/blog/how-to-check-property-title-is-clear).",
      },
      {
        type: "p",
        text: "Comparing the total cost of different homes? Browse [apartments for sale](/buy/apartment), [houses for sale](/buy/house) and [plots](/plot), then use the [rent vs buy calculator](/tools/rent-vs-buy-calculator) to see the full picture.",
      },
    ],
  },
  {
    slug: "capital-gains-tax-on-property-explained",
    title: "Capital gains tax when you sell a property in India: how it works and ways to save tax",
    description:
      "How the capital gain on a property sale is worked out, short-term versus long-term, and exemptions such as Sections 54 and 54EC. Confirm with a tax adviser.",
    published: "2026-10-21",
    format: "Explainer",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "General information, not tax advice. Tax rates, holding periods, indexation and exemption limits have changed in recent years and can change again. This page does not quote rates, so it cannot go out of date on them. Confirm the rules for your sale, and for the year you sell, with a chartered accountant or tax adviser.",
      },
      { type: "h2", text: "How is capital gains tax on a property sale calculated?" },
      {
        type: "p",
        text: "The gain is the sale price minus what the property cost you to buy and improve, and minus the expenses of selling. The tax is charged on that gain, not on the whole price. Which rate applies depends on whether the gain is short-term or long-term, and that depends on how long you held the property.",
      },
      {
        type: "ul",
        items: [
          "Sale price: the full value you receive, or the government's guideline value if that is higher and the tax rules say it counts.",
          "Cost of acquisition: what you paid, including stamp duty and registration at the time.",
          "Cost of improvement: money spent on additions and major improvements, with proof. Routine repairs usually do not count.",
          "Selling expenses: brokerage and legal costs of this sale.",
          "Gain = sale price - (acquisition cost + improvement cost + selling expenses).",
        ],
      },
      { type: "h2", text: "What is the difference between short-term and long-term gains?" },
      {
        type: "p",
        text: "The law sets a holding period. Sell after holding the property for longer than that period and the gain is long-term. Sell before it and the gain is short-term. A short-term gain is generally added to your income and taxed at your normal slab rate, while a long-term gain is taxed at its own special rate. Check the current period and rate for the year you sell.",
      },
      { type: "h2", text: "What is indexation, and does it still apply?" },
      {
        type: "p",
        text: "Indexation adjusted the purchase cost upward for inflation, so that a long-term gain reflected real growth rather than inflation alone. The rules on whether it is available, for which purchases and at which rate, have been changed by recent budgets. Do not assume your adviser's last answer still holds. Ask which method applies to a property bought on your date, and whether you are allowed to choose.",
      },
      { type: "h2", text: "How can I save tax on the gain?" },
      {
        type: "p",
        text: "The Income Tax Act allows some exemptions on long-term gains if you reinvest the money in specified ways. Each has conditions on time, amount and what you may buy, so the details matter.",
      },
      {
        type: "ul",
        items: [
          "Section 54: for a long-term gain on a residential house, reinvesting in another residential house within the allowed time. Limits and conditions apply, and the new house may not be sold again too soon.",
          "Section 54EC: for a long-term gain on land or a building, investing in specified bonds within the allowed time, up to a stated limit, and holding them for the required period.",
          "Section 54F: for a long-term gain on an asset other than a house, investing the sale proceeds in a residential house, with conditions about what else you own.",
          "Capital gains account scheme: if you have not reinvested before your tax return is due, you can deposit the unused amount in this account so the exemption is not lost.",
        ],
      },
      { type: "h2", text: "What records should I keep?" },
      {
        type: "ol",
        items: [
          "The sale deed of your purchase, and proof of the stamp duty and registration you paid then.",
          "Receipts and contractor bills for improvements.",
          "The sale agreement and deed for this sale, and the bills for brokerage and legal fees.",
          "Bank records of the money received and any reinvestment you make.",
          "Your adviser's written working of the tax.",
        ],
      },
      {
        type: "p",
        text: "If you plan to sell, read [how to sell property online in India](/blog/how-to-sell-property-online-in-india) and prepare the papers using the [documents checklist](/blog/property-approvals-documents-checklist). Costs on the way in matter too: see [stamp duty and registration](/blog/stamp-duty-and-registration-charges-explained).",
      },
    ],
  },
  {
    slug: "womens-pg-checklist",
    title: "Women-only PG: what to check before you book, in any Indian city",
    description:
      "How to choose a safe women-only PG: what to check on safety, rooms, food, location, costs and rules, and what to get in writing before you pay a deposit.",
    published: "2026-10-23",
    format: "Checklist",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "General information to help you decide, not legal advice. Check every detail yourself, and visit in person before you pay. Bhavano does not inspect PGs. See what we do and do not check on our [trust page](/trust).",
      },
      { type: "h2", text: "What should I check before booking a women-only PG?" },
      {
        type: "p",
        text: "Check five things: safety, the room and facilities, food, the location and your daily commute, and the total monthly cost with the house rules. A PG can look good in photos and feel very different once you live there, so visit in person, in the evening, before you pay anything. This list works in any city, from Chennai and Bengaluru to Pune and Delhi NCR.",
      },
      { type: "h2", text: "How do I check that a PG is safe?" },
      {
        type: "ul",
        items: [
          "Confirm it is genuinely women-only and ask who runs it: an owner who lives on site, a manager or a warden.",
          "Look for working locks, a secure entrance, CCTV in common areas, and a record of who visits.",
          "Ask what the night-entry rule is, who is on duty overnight, and whom to call in an emergency.",
          "Go back in the evening. Check the street lighting, how the neighbourhood feels after dark, and whether autos and buses are easy to find.",
          "Speak to current residents about how safe they feel and how complaints are handled.",
        ],
      },
      { type: "h2", text: "What should I look for in the room and facilities?" },
      {
        type: "ul",
        items: [
          "See the exact bed you would get, not a sample room. Check light, ventilation, the mattress, a cupboard, a desk and charging points.",
          "Decide between single, double or triple sharing, and ask who your roommates would be and whether the management can change them later.",
          "Test the bathroom, water pressure and hot water. Ask how many people share each bathroom.",
          "Check the Wi-Fi speed where your bed is, plus the laundry arrangements and the fan or AC.",
          "Ask how often rooms and bathrooms are cleaned, and look at the common areas for signs.",
        ],
      },
      { type: "h2", text: "What should I ask about food?" },
      {
        type: "ul",
        items: [
          "Which meals are included, and at what times? Is there a weekly menu?",
          "Is the drinking water filtered? Can you see the kitchen?",
          "Can you cook, keep a fridge, or order food in?",
          "What happens if you miss a meal or are away for a few days?",
        ],
      },
      { type: "h2", text: "How do I judge the location and commute?" },
      {
        type: "p",
        text: "Pick a PG close to your office, college or the bus or metro route you will use daily. Test the journey at the time you will actually travel, not just on a map. Also check the walk to shops, a pharmacy and a clinic, and think about traffic and waterlogging in the rains. If you are new to the city, our [guide to moving to a new city](/moving-to-a-new-city) covers the other things to settle early.",
      },
      { type: "h2", text: "What is the real monthly cost, and what rules should I get in writing?" },
      {
        type: "p",
        text: "Do not compare PGs on rent alone. Ask for every charge in writing: rent per person or per room, food, electricity and AC, Wi-Fi, laundry, housekeeping and the deposit. Then ask for the rules in writing too.",
      },
      {
        type: "ul",
        items: [
          "The curfew, and what happens if you return late from a shift.",
          "Visitor rules, including whether family can visit and whether anyone can stay overnight.",
          "The notice period, and any penalty for leaving early.",
          "How much deposit you pay, when it is returned and what can be deducted. See [how a security deposit works](/blog/security-deposit-for-rent-in-india).",
          "Whether the rent can rise during your stay, and whether you get a signed agreement and receipts. See [rental agreement questions](/blog/rental-agreement-questions).",
        ],
      },
      { type: "h2", text: "How do I find women-only PGs on Bhavano?" },
      {
        type: "p",
        text: "Bhavano is an Indian property marketplace where PG owners and managers list directly. Open [PG listings](/pg), pick your city and area, and look at each listing's details, which show the sharing types, meals and price, and, where the owner has filled it in, who the PG is for (men, women or co-ed). For example, you can browse the [PG listings in Chennai](/chennai/pg). Message the poster to ask the questions above, and then visit before you pay.",
      },
      {
        type: "p",
        text: "Before you pay a deposit, read [how to verify an owner](/blog/verify-property-owner-before-paying-token) and [how to spot a bad property ad](/blog/spotting-a-bad-property-ad). For the full visit checklist, see our [PG hunting checklist](/blog/pg-hunting-checklist). If you run a women's PG, you can [list it on Bhavano](/post).",
      },
    ],
  },
  // "Established builders in <city>" guides: kept in their own file so each correction is one line.
  ...BUILDER_GUIDES,
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
