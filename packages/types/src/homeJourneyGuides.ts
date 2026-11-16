import type { BlogPost } from "./blogPosts";

/** Blog posts for the steps around a deal that the earlier posts did not cover: photographing a property and setting the rent (owners),
 * moving into a rented flat and checking a new flat at possession (tenants and buyers), applying for a home loan, and mutation after
 * a purchase. Appended to POSTS in blogPosts.ts. Published 2026-11-16. See docs/plans/blog-backlink-content.md, seventh batch.
 *
 * Same rules as the rest of the blog: the answer comes first, headings are the questions, no prices, rents, rates or percentages, no
 * invented author. The loan and mutation posts touch financial and legal ground, say so in a note at the top, were written from
 * general knowledge and must be read by a qualified person before they are promoted. */

export const HOME_JOURNEY_GUIDES: BlogPost[] = [
  {
    slug: "how-to-photograph-your-property-for-a-listing",
    title: "How to photograph your property with a phone so the ad gets enquiries",
    description:
      "Which rooms to shoot, in what order, at what time of day, and the small fixes that make phone photos of a flat, house, PG or plot look honest and clear.",
    published: "2026-11-16",
    format: "Guide",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "Good listing photos are bright, straight and honest, and they show every room a visitor will ask about. You do not need a camera: a phone, daylight and fifteen minutes of tidying are enough. Buyers and tenants decide from the photos whether to message you, so they are the most important part of the ad.",
      },
      { type: "h2", text: "How many photos do I need, and which ones?" },
      {
        type: "p",
        text: "Bhavano asks for at least three photos before an ad can go live, but more helps: aim for one or two of every room. Take them in the order a visitor walks through, so the gallery reads like a visit.",
      },
      {
        type: "ol",
        items: [
          "The outside: the building or gate from the street, so people can recognise it when they arrive.",
          "The living room, from the corner that shows the most floor.",
          "The kitchen, with the counter clear.",
          "Each bedroom, including the wardrobe and the window.",
          "Each bathroom, with the lid down and towels put away.",
          "The balcony and the view from it.",
          "The extras people ask about: parking, lift, power backup, the society's garden or gym.",
        ],
      },
      { type: "h2", text: "What time of day is best?" },
      {
        type: "p",
        text: "Shoot on a bright day, in the late morning or early afternoon, with every curtain open and every light on. Daylight makes rooms look their real size and colour. Avoid evenings, when phone photos turn grainy and yellow, and avoid shooting straight into a bright window, which turns the room dark.",
      },
      { type: "h2", text: "How do I hold the phone?" },
      {
        type: "ul",
        items: [
          "Hold it in landscape (sideways) for rooms, at chest height, and keep it level so walls look straight.",
          "Stand in a corner or a doorway to fit more of the room in. Use the phone's wide lens if it has one, but not the fish-eye extremes.",
          "Tap the screen on the darkest part of the room to brighten the shot.",
          "Wipe the lens first. A smudged lens is the most common reason phone photos look hazy.",
          "Turn off heavy filters and beauty modes. Photos should look like the place does.",
        ],
      },
      { type: "h2", text: "What should I fix before I shoot?" },
      {
        type: "ul",
        items: [
          "Clear the floors and counters: shoes, bags, clothes, dishes and wires.",
          "Make the beds and straighten cushions and curtains.",
          "Put away anything personal: family photos, documents, medicines.",
          "Fix or remove what draws the eye: a dead bulb, a dripping tap, a broken handle.",
          "If the home is let, ask the tenant first and agree a time.",
        ],
      },
      { type: "h2", text: "What about plots, PGs and commercial spaces?" },
      {
        type: "ul",
        items: [
          "Plot: the boundary stones or fence, the road in front, the approach road and the neighbouring buildings. A photo of the site board, if there is one, helps.",
          "PG: the exact rooms for each sharing type, the bathroom, the dining area and the kitchen, and the entrance.",
          "Office or shop: the frontage and signage space, the main floor from the door, the washroom, the pantry and the parking.",
        ],
      },
      { type: "h2", text: "What should I never do?" },
      {
        type: "p",
        text: "Never use photos of another property, a builder's brochure render presented as the real flat, or pictures taken before a renovation you have not done. Visitors notice at the door, and listings whose photos do not match the place can be removed. Read [what makes a property ad look untrustworthy](/blog/spotting-a-bad-property-ad) to see your ad the way a careful buyer will.",
      },
      { type: "h2", text: "How do I add them to my ad on Bhavano?" },
      {
        type: "p",
        text: "On [Post an ad](/post), add photos from the camera or the gallery on the details step, then write the rest of the ad using [how to write a listing that gets enquiries](/blog/write-a-property-listing-that-gets-enquiries). Stuck on the form? Use the [contact form](/contact) and our team can help you post it. For the whole selling path, see [how to sell property online in India](/blog/how-to-sell-property-online-in-india).",
      },
    ],
  },
  {
    slug: "how-to-set-the-right-rent-for-your-property",
    title: "How to set the right rent for your flat or house in India",
    description:
      "A step-by-step way for owners to price a rental: compare similar homes nearby, adjust for what yours has, decide what is included, and know when to revise.",
    published: "2026-11-16",
    format: "Guide",
    readingMinutes: 6,
    body: [
      {
        type: "p",
        text: "Set the rent by comparing your home with similar homes for rent in the same area today, then adjusting up or down for what yours has or lacks. Price it a little too high and it sits empty, which costs more than a slightly lower rent. Price it right and you get more enquiries to choose a good tenant from.",
      },
      { type: "h2", text: "Step 1: Which homes should I compare with?" },
      {
        type: "p",
        text: "Find five to ten homes like yours that are for rent now: same area, same number of bedrooms, a similar size and a similar kind of building. Open [apartments for rent](/rent-lease/apartment) or [houses for rent](/rent-lease/house), choose your city and area, and note each one's rent, size, floor, furnishing and age. Asking rents are a guide, not the final rent, so also ask neighbours or the society office what similar homes actually let for recently.",
      },
      { type: "h2", text: "Step 2: How do I adjust for my home?" },
      {
        type: "ul",
        items: [
          "Size: compare like with like. See [carpet, built-up and super built-up area](/blog/carpet-built-up-super-built-up-area) so you are not comparing different measures.",
          "Furnishing: unfurnished, semi-furnished (wardrobes, kitchen, fans and lights) or fully furnished. Each step up supports a higher rent but also means more to maintain.",
          "Building and society: lift, power backup, security, parking, a gym or pool.",
          "Floor, light and view, and whether it faces a busy road.",
          "Condition: fresh paint and working fittings let you ask for the top of the range. Fix them before you list, not after.",
          "Commute: being close to an office hub, a metro station or a school often matters more to tenants than finishes.",
        ],
      },
      { type: "h2", text: "Step 3: What is included in the rent?" },
      {
        type: "p",
        text: "Decide what the rent covers and say it in the ad: society maintenance, water, parking, internet. Tenants compare the total they will pay each month, so a lower rent with maintenance added on can look similar to a higher rent that includes it. Read [what society maintenance charges cover](/blog/society-maintenance-charges-explained) if you are unsure what to pass on.",
      },
      { type: "h2", text: "Step 4: How much deposit, and what yearly increase?" },
      {
        type: "p",
        text: "The deposit and the yearly increase are part of the price too. Both vary by city and are agreed in the rental agreement, so check what is usual locally and write it down clearly. See [how a security deposit works](/blog/security-deposit-for-rent-in-india) and [rental agreement questions](/blog/rental-agreement-questions).",
      },
      { type: "h2", text: "Step 5: How do I know if my rent is right?" },
      {
        type: "ul",
        items: [
          "Plenty of enquiries in the first days but no one agrees after the visit: the photos may be better than the home, or the rent is a little high for its condition.",
          "Very few enquiries in the first week or two: the rent is probably above the market, or the ad is missing photos or details.",
          "Many enquiries and a quick yes: you may be slightly under the market, which is fine if it gets you a good tenant fast.",
        ],
      },
      { type: "h2", text: "Is it worth checking the rental yield?" },
      {
        type: "p",
        text: "If you bought the home as an investment, yes. The yield tells you what the rent returns on the property's value, and helps you decide whether to rent, renovate or sell. See [how to calculate rental yield](/blog/how-to-calculate-rental-yield).",
      },
      { type: "h2", text: "How do I list it?" },
      {
        type: "p",
        text: "Post the home on [Bhavano](/post) with the rent, deposit and what is included, then read [how to find reliable tenants](/blog/how-to-find-reliable-tenants) before the first visit. Good photos make the rent look fair: see [how to photograph your property](/blog/how-to-photograph-your-property-for-a-listing).",
      },
    ],
  },
  {
    slug: "rented-flat-move-in-checklist",
    title: "Moving into a rented flat: the move-in checklist that protects your deposit",
    description:
      "What to check, photograph and write down on the day you move into a rented home, so the deposit comes back in full when you leave.",
    published: "2026-11-16",
    format: "Checklist",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "On the day you move in, walk through the flat with the owner, record the condition of every room and fitting with dated photos, note the meter readings, and get a signed list of what is provided. Most deposit disputes at move-out are about damage that was already there, and a record made on day one settles them.",
      },
      { type: "h2", text: "What should I have before I get the keys?" },
      {
        type: "ul",
        items: [
          "A signed rental agreement, with the rent, deposit, notice period and lock-in written down. See [rental agreement questions](/blog/rental-agreement-questions) and [rent agreement types](/blog/rent-agreement-types-india).",
          "Receipts for the token, the deposit and the first month's rent, paid by a traceable method.",
          "The owner's contact details, and the society office or caretaker's number.",
          "Whether police verification of tenants is needed in your city, and who will do it.",
        ],
      },
      { type: "h2", text: "What should I check, room by room?" },
      {
        type: "ol",
        items: [
          "Walls and ceilings: cracks, damp patches, peeling paint, nail holes.",
          "Floors and tiles: chips, cracks and loose tiles.",
          "Doors, windows and locks: that every one opens, closes and locks, and that you have every key.",
          "Electrical: every switch, socket, light and fan, and the main board.",
          "Plumbing: every tap and shower for flow and leaks, the flush, and the drains, including under the kitchen sink.",
          "Kitchen: the chimney, the hob or gas line and the cabinets.",
          "Furniture and appliances that come with the flat: that they work, and their condition.",
        ],
      },
      { type: "h2", text: "How should I record it?" },
      {
        type: "ul",
        items: [
          "Take photos and a short video of every room, with close-ups of any damage. Keep the files with their dates.",
          "Write an inventory: every item provided (beds, wardrobes, fans, lights, curtains, appliances) and its condition.",
          "Note the electricity, water and gas meter readings, with a photo of each meter.",
          "Send the photos and the list to the owner on the same day, by email or message, and ask them to confirm. A message they replied to is a record both sides can see.",
        ],
      },
      { type: "h2", text: "What should I sort out in the first week?" },
      {
        type: "ul",
        items: [
          "Ask the owner to fix anything you found that does not work, and agree who pays for what, in writing.",
          "Find out how the electricity bill, water and maintenance are paid, and whose name they are in.",
          "Change the address on your bank, office and delivery accounts.",
          "Register with the society if it asks for tenant details, and get the gate or parking passes.",
        ],
      },
      { type: "h2", text: "And when I move out?" },
      {
        type: "p",
        text: "Repeat the same walk-through with the owner, using your move-in photos, and take final meter readings. Give notice as the agreement says, and ask in writing when and how the deposit will be returned. See [how to get your security deposit back](/blog/security-deposit-for-rent-in-india).",
      },
      {
        type: "p",
        text: "Still looking for a place? Browse [apartments for rent](/rent-lease/apartment) and [houses for rent](/rent-lease/house), and take the [flat viewing checklist](/blog/flat-viewing-checklist) on every visit. Moving cities? Read [moving to a new city](/moving-to-a-new-city).",
      },
    ],
  },
  {
    slug: "new-flat-possession-snagging-checklist",
    title: "Taking possession of a new flat: the snagging checklist to use before you sign",
    description:
      "A room-by-room inspection list for a new flat from a builder: what to test, how to record defects, and what to ask for before you sign the possession letter.",
    published: "2026-11-16",
    format: "Checklist",
    readingMinutes: 7,
    body: [
      {
        type: "note",
        text: "General information to help you inspect a home, not legal or engineering advice. For a large purchase, consider hiring an independent home inspector, and read your sale agreement for what the builder must fix and by when.",
      },
      {
        type: "p",
        text: "Before you sign the possession letter for a new flat, inspect it room by room, list every defect (a \"snag\") with photos, give the list to the builder in writing and ask for a date by which it will be fixed. Once you have signed and moved in, it is harder to show that a defect came from construction rather than from use.",
      },
      { type: "h2", text: "What should I take to the inspection?" },
      {
        type: "ul",
        items: [
          "The approved floor plan and the specification list from your agreement (tiles, fittings, doors, windows).",
          "A phone for photos, a torch, a measuring tape, a small spirit level, and a phone charger to test sockets.",
          "A bucket or bottle of water to test the floor slope in bathrooms and balconies.",
          "Someone to help. Two people find more than one.",
        ],
      },
      { type: "h2", text: "What should I check in each room?" },
      {
        type: "ol",
        items: [
          "Walls and ceilings: cracks, uneven plaster, damp patches and paint finish. Look along the wall with a torch held flat to see bumps.",
          "Floors: hollow-sounding tiles (tap them), cracks, chips, uneven joints and the level.",
          "Doors and windows: that each opens and closes smoothly, locks, and seals, with no gaps letting in light or rain. Check the glass for cracks.",
          "Electrical: every switch, socket and light point, the earthing, the main board and the trip switches. Plug the charger into every socket.",
          "Plumbing: run every tap and shower, flush every toilet, check the hot and cold lines, and look under the sinks for leaks.",
          "Bathrooms and balconies: pour water and watch it run to the drain without pooling. Check for seepage marks on the ceiling below if you can.",
          "Kitchen: the counter, the sink, the chimney and gas points, and the cabinet hinges.",
          "Measurements: measure the rooms and compare with the plan. See [carpet, built-up and super built-up area](/blog/carpet-built-up-super-built-up-area).",
        ],
      },
      { type: "h2", text: "What about the building and the common areas?" },
      {
        type: "ul",
        items: [
          "The lifts, the fire safety equipment and the power backup.",
          "Your allotted parking, and that it matches your agreement.",
          "Water supply: the source, the tanks, and the pressure on your floor.",
          "The amenities promised in the brochure and agreement: are they finished and working?",
          "The entrance, security, and lighting in the stairwells and parking.",
        ],
      },
      { type: "h2", text: "How do I record and report the snags?" },
      {
        type: "ol",
        items: [
          "Write each defect with its room and a photo, numbered, in one list.",
          "Give the list to the builder in writing and keep their acknowledgement.",
          "Agree a date for the fixes, then inspect again and tick off each item.",
          "Sign the possession letter only once the important items are fixed, or with the open items listed in writing.",
        ],
      },
      { type: "h2", text: "Which documents should I collect at possession?" },
      {
        type: "ul",
        items: [
          "The possession letter, and copies of the completion or occupancy certificate. See [occupancy and completion certificates](/blog/occupancy-certificate-and-completion-certificate).",
          "Receipts for every payment, and a statement that nothing more is due other than what is listed.",
          "The warranty papers for fittings and appliances, and the builder's terms for repairing structural defects.",
          "Details of the society or association, maintenance charges and the corpus fund. See [society maintenance charges](/blog/society-maintenance-charges-explained).",
          "The meter and utility connection details.",
        ],
      },
      { type: "h2", text: "Does RERA help if defects appear later?" },
      {
        type: "p",
        text: "For a registered project, the law sets a period after possession during which the builder must fix structural and workmanship defects, and the state's RERA authority is where complaints go. Check the details for your state and your agreement. See [RERA explained for home buyers](/blog/rera-explained-for-home-buyers).",
      },
      {
        type: "p",
        text: "Still choosing? Compare [ready-to-move and under-construction flats](/blog/ready-to-move-vs-under-construction), browse [apartments for sale](/buy/apartment), and read [what to check at each construction stage](/blog/construction-stage-to-buy-from-builder).",
      },
    ],
  },
  {
    slug: "home-loan-process-and-documents-india",
    title: "How to apply for a home loan in India: the steps and the documents you need",
    description:
      "The home loan process from eligibility to disbursement: what the bank checks, which documents salaried and self-employed applicants need, and common delays.",
    published: "2026-11-16",
    format: "Explainer",
    readingMinutes: 7,
    body: [
      {
        type: "note",
        text: "General information, not financial advice. Each bank and housing finance company has its own rules and document list, and they change. Confirm the details with the lender before you apply.",
      },
      {
        type: "p",
        text: "A home loan moves through six stages: you check what you can borrow, choose a lender and apply with your documents, the lender checks your income and credit, it checks the property's papers and value, it sanctions the loan, and it pays the money (disbursement) once the sale agreement is signed. Having your documents ready and the property's papers clear are the two things that most speed it up.",
      },
      { type: "h2", text: "How much can I borrow?" },
      {
        type: "p",
        text: "The lender looks at your income, your existing loans and EMIs, your age, and your credit history, and it lends only part of the property's value, so you pay the rest as a down payment. Try the [home loan eligibility calculator](/tools/home-loan-eligibility-calculator), the [EMI calculator](/tools/emi-calculator) and the [down payment calculator](/tools/down-payment-calculator), and read [how much down payment you need](/blog/down-payment-for-a-home-loan).",
      },
      { type: "h2", text: "What are the steps, in order?" },
      {
        type: "ol",
        items: [
          "Check your credit report and fix any errors before you apply.",
          "Compare lenders on the interest rate type (fixed or floating), fees, prepayment terms and service, not only the headline rate.",
          "Apply, and submit your KYC, income and property documents.",
          "The lender verifies your income, employment and credit history, and may visit your office or home.",
          "The lender's legal team checks the property's title and approvals, and a valuer assesses its value.",
          "You receive a sanction letter with the amount, rate, tenure and conditions. Read it fully before you accept.",
          "You sign the loan agreement, and the lender pays the seller or builder: in one go for a ready property, in stages for one under construction.",
        ],
      },
      { type: "h2", text: "Which documents do salaried applicants need?" },
      {
        type: "ul",
        items: [
          "Identity and address proof (PAN card, Aadhaar, passport or similar), and photographs.",
          "Recent salary slips and bank statements showing the salary coming in.",
          "Form 16 or income tax returns for recent years.",
          "An employment letter or proof of how long you have been with your employer, if asked.",
          "Details of any existing loans.",
        ],
      },
      { type: "h2", text: "What extra do self-employed applicants need?" },
      {
        type: "ul",
        items: [
          "Income tax returns, with the profit and loss statement and balance sheet, for recent years, often prepared by a chartered accountant.",
          "Business bank statements.",
          "Proof the business exists and how long it has run: registration, GST registration, a shop licence or similar.",
        ],
      },
      { type: "h2", text: "Which property documents will the lender ask for?" },
      {
        type: "p",
        text: "The lender wants the same papers a careful buyer checks: the title chain, the sale agreement or allotment letter, approved plans, the encumbrance certificate, and for a new project its RERA registration and the builder's approvals. If the property's papers are not clear, most lenders will not lend on it, which is a useful check in itself. See [how to check a property's title](/blog/how-to-check-property-title-is-clear) and the [documents checklist](/blog/property-approvals-documents-checklist).",
      },
      { type: "h2", text: "What usually delays a home loan?" },
      {
        type: "ul",
        items: [
          "Missing or mismatched documents, such as a different spelling of your name across papers.",
          "A low credit score, or many recent loan or card applications.",
          "Gaps in the property's title chain, or missing approvals.",
          "A valuation lower than the agreed price, which means a larger down payment.",
        ],
      },
      { type: "h2", text: "What costs come on top of the loan?" },
      {
        type: "p",
        text: "Plan for the processing fee, legal and valuation charges, stamp duty and registration, and any insurance the lender offers. Stamp duty and registration are usually paid by the buyer and not covered by the loan. See [stamp duty and registration charges](/blog/stamp-duty-and-registration-charges-explained) and [the property registration process](/blog/property-registration-process-india).",
      },
      {
        type: "p",
        text: "Ready to look? Browse [apartments for sale](/buy/apartment), [houses](/buy/house) and [villas](/buy/villa), and work out your EMI first with [home loan EMI explained](/blog/home-loan-emi-explained).",
      },
    ],
  },
  {
    slug: "property-mutation-after-buying-india",
    title: "Property mutation in India: what it is and how to do it after you buy",
    description:
      "What mutation of property means, why it matters for tax and future sales, the documents usually needed, and how the process works across Indian states.",
    published: "2026-11-16",
    format: "Explainer",
    readingMinutes: 5,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. The name, the office and the process for mutation differ by state and by city. Check with your local municipal or revenue office, or a property lawyer.",
      },
      {
        type: "p",
        text: "Mutation is updating the government's land or municipal records to show you as the new owner after you buy, inherit or are gifted a property. Registration of the sale deed transfers ownership; mutation records that change with the local authority, so the property tax bills and the revenue records are in your name.",
      },
      { type: "h2", text: "Is mutation the same as registration?" },
      {
        type: "p",
        text: "No. Registration at the sub-registrar's office makes the sale deed a legal record of the transfer. Mutation is a separate step at the municipal body (for a flat or house in a city) or the revenue department (for land), and it updates their records. Read [the property registration process](/blog/property-registration-process-india) for the step before this one.",
      },
      { type: "h2", text: "Why does mutation matter?" },
      {
        type: "ul",
        items: [
          "Property tax bills come in your name, and you can pay them.",
          "You can apply for utility connections and some approvals as the owner.",
          "When you sell later, buyers and their lenders will check that the records match the deed. Gaps slow a sale down.",
          "For agricultural land, the revenue record is often what shows who holds and farms the land.",
        ],
      },
      { type: "h2", text: "What is it called in different states?" },
      {
        type: "p",
        text: "The idea is the same, but the record has local names: khata in Karnataka, patta in Tamil Nadu, and terms such as jamabandi, 7/12 extract or khatauni for land records elsewhere. In Bengaluru, see [A khata and B khata](/blog/a-khata-b-khata-bengaluru).",
      },
      { type: "h2", text: "Which documents are usually needed?" },
      {
        type: "ul",
        items: [
          "A copy of the registered sale deed (or the will, succession certificate or gift deed for inheritance and gifts).",
          "The latest property tax receipt, paid up to date.",
          "Identity and address proof of the new owner.",
          "An application in the authority's form, with any fee it charges.",
          "For inheritance: the death certificate, and documents showing the legal heirs, such as an affidavit or no-objection from other heirs.",
        ],
      },
      { type: "h2", text: "How does the process work?" },
      {
        type: "ol",
        items: [
          "Apply to the municipal or revenue office, online where the state offers it, with the documents.",
          "The office checks the documents and may issue a public notice or visit the property.",
          "If no objection comes in, the record is updated and you receive the mutation certificate or an updated record.",
          "Check the updated record carefully: names, area and survey or property numbers.",
        ],
      },
      { type: "h2", text: "Does a mutation record prove ownership?" },
      {
        type: "p",
        text: "On its own, no. Courts have generally treated mutation records as being for revenue and tax purposes; ownership rests on the title documents. That is why, when buying, you check the title chain and not only the tax receipts. See [how to check a property's title is clear](/blog/how-to-check-property-title-is-clear).",
      },
      {
        type: "p",
        text: "Buying or selling? Prepare the papers with the [documents checklist](/blog/property-approvals-documents-checklist), browse [houses for sale](/buy/house) and [plots](/plot), or [post your property](/post).",
      },
    ],
  },
];
