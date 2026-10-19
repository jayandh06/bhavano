"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSTS = exports.DEFAULT_BYLINE = void 0;
exports.getPost = getPost;
exports.sortedPosts = sortedPosts;
exports.bylineFor = bylineFor;
exports.parseInline = parseInline;
exports.DEFAULT_BYLINE = "Bhavano Editorial Team";
exports.POSTS = [
    {
        slug: "pg-hunting-checklist",
        title: "PG hunting checklist: what to check before you pay",
        description: "A step-by-step checklist for finding a paying-guest room in a new city: what to ask, what to look at on the visit, and what to get in writing.",
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
        description: "A balanced look at coworking and a rented office for freelancers and small teams: flexibility, cost shape, privacy, and when to switch.",
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
        description: "The questions worth asking about deposit, notice, repairs and rent increases before you sign a house rental agreement. General information, not legal advice.",
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
        description: "Practical signs that a property listing may be unreliable: photos, prices, pressure to pay, and what to do before you part with money.",
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
        description: "What carpet, built-up and super built-up area mean in a flat listing, why the same flat can show three sizes, and how to compare listings fairly.",
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
        description: "A calm way to think through renting versus buying: your timeline, savings, flexibility and the costs people forget, with no one-size-fits-all answer.",
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
        description: "A plain explanation of what makes up a home loan EMI and how tenure, interest rate and down payment change it, with links to free calculators.",
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
        description: "A room-by-room checklist for visiting a flat: water, light, damp, locks, noise and the neighbourhood, so you notice problems before you commit.",
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
        description: "For owners and agents: the photos, details and honest description that make a rental or sale listing easier to trust, so you get fewer time-wasting calls.",
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
    {
        slug: "buying-a-plot-checklist",
        title: "Buying a plot of land: documents and checks before you pay",
        description: "A plain checklist for buying a residential plot: ownership papers, approvals, boundaries and payment, so you know what to ask before you commit.",
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
                text: "When you are ready to look, browse [plots for sale](/plot) and use the [area unit converter](/tools/area-unit-converter) if a listing quotes a size in a unit you do not use every day. Bhavano checks listings before they go live but does not verify land documents, so read [how we check listings and what we don't verify](/trust).",
            },
        ],
    },
    {
        slug: "real-estate-investment-basics",
        title: "Real estate investment basics: what first-time buyers should understand",
        description: "How property earns money (rent and value growth), what can go wrong, and the questions to ask before buying a flat or plot as an investment.",
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
        description: "The trade-offs between buying a ready-to-move flat and an under-construction one: timing, risk, flexibility and what to verify for each.",
        published: "2026-10-19",
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
        description: "From preparing the paperwork to replying to buyers: how to sell a house or flat online safely, with the steps owners often skip.",
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
                text: "Ready to list? You can [post your property on Bhavano](/post). Our guide to [writing a listing that gets enquiries](/blog/write-a-property-listing-that-gets-enquiries) covers the listing step in more detail, and you can see how others present [houses for sale](/buy/house).",
            },
        ],
    },
    {
        slug: "how-to-find-reliable-tenants",
        title: "Renting out your house: how to find a reliable tenant",
        description: "How owners can attract good tenants and avoid common problems: pricing, screening, the agreement, the deposit and house rules.",
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
        description: "How to choose and check a commercial space to rent: location, layout, running costs, the lease terms and the permissions your business needs.",
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
        description: "An honest comparison of living in a villa and in an apartment: space, upkeep, security, community, cost shape and who each suits best.",
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
        description: "When renting a storage unit makes sense, how to compare them, and the questions to ask about access, security, insurance and the contract.",
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
];
function getPost(slug) {
    return exports.POSTS.find((p) => p.slug === slug);
}
/** Newest first. */
function sortedPosts() {
    return [...exports.POSTS].sort((a, b) => b.published.localeCompare(a.published));
}
function bylineFor(post) {
    return post.author ? post.author.name : exports.DEFAULT_BYLINE;
}
function parseInline(text) {
    const parts = [];
    const re = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
    let last = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
        if (match.index > last)
            parts.push({ kind: "text", text: text.slice(last, match.index) });
        parts.push({ kind: "link", text: match[1], href: match[2] });
        last = match.index + match[0].length;
    }
    if (last < text.length)
        parts.push({ kind: "text", text: text.slice(last) });
    return parts;
}
