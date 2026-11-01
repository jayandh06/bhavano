import type { BlogPost } from "./blogPosts";

/** Blog posts written for the questions people put to AI assistants and search: renting without a
 * broker, agreement types, tenant papers, registration, NRIs, TDS and choosing an area. Appended to
 * POSTS in blogPosts.ts. Published 2026-11-01. See docs/plans/ai-visibility-backlinks-and-articles.md.
 *
 * Same rules as the rest of the blog: the answer comes first, headings are the questions, no prices,
 * rents, rates, thresholds or percentages, no invented author. The legal and tax posts say so in a
 * note at the top, were written from general knowledge and must be read by a qualified person before
 * they are promoted. Area guides name well-known neighbourhoods and describe them by commute and
 * kind of housing only, never by price. */

export const ANSWER_GUIDES: BlogPost[] = [
  {
    slug: "rent-a-house-without-a-broker-india",
    title: "How to rent a house or flat without a broker in India",
    description:
      "Yes, you can rent directly from the owner. Where to find owner listings, what to check, how to negotiate and what to put in writing so no broker is needed.",
    published: "2026-11-01",
    format: "Guide",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "Yes. You can rent a house or flat in India without a broker by dealing with the owner directly. Find owner-posted listings, visit with the owner, agree the terms in writing and sign a rent agreement. There is no law that makes a broker compulsory for a rental, so brokerage is a cost you pay only if you choose to use one.",
      },
      { type: "h2", text: "Where do I find owners who rent directly?" },
      {
        type: "ul",
        items: [
          "Marketplaces where owners post themselves, such as [apartments for rent](/rent-lease/apartment) and [houses for rent](/rent-lease/house) on Bhavano. Look for the poster being the owner.",
          "Notice boards and resident groups in the societies and streets you like. Many owners tell the security desk or the society office first.",
          "'To-let' boards on gates, which are usually put up by the owner.",
          "Your office, college or friends. A recommendation from someone who has rented from the owner is the strongest lead.",
        ],
      },
      { type: "h2", text: "How do I check that I am talking to the owner?" },
      {
        type: "ol",
        items: [
          "Ask for the owner's name and compare it with the name on the electricity bill, property tax receipt or sale deed. You are checking identity, not asking for the whole file.",
          "Ask who lives nearby or collects the rent. A genuine owner can answer without hesitation.",
          "Meet at the property, not at a cafe, and let the owner open the door.",
          "If the owner lives abroad and a relative or manager acts for them, ask to see written authority before you pay anything.",
        ],
      },
      {
        type: "p",
        text: "Read [how to verify a property owner before paying a token](/blog/verify-property-owner-before-paying-token) and [how to spot a bad property ad](/blog/spotting-a-bad-property-ad) before you pay.",
      },
      { type: "h2", text: "What can I negotiate when there is no broker?" },
      {
        type: "ul",
        items: [
          "The monthly rent, and how much it can rise at renewal.",
          "The security deposit and when and how it is returned. See [how a security deposit works](/blog/security-deposit-for-rent-in-india).",
          "What is included: furniture, appliances, parking and maintenance.",
          "Who pays for repairs, painting at move-out and the society's charges.",
          "The notice period and the lock-in, if any.",
        ],
      },
      { type: "h2", text: "What should I get in writing?" },
      {
        type: "p",
        text: "Without a broker, the paper is the only record. Sign a rent agreement that names both sides, lists the amounts and dates, and records the condition of the home at move-in with dated photos. Pay by a traceable method and keep every receipt. [Rental agreement questions](/blog/rental-agreement-questions) and [rent agreement types in India](/blog/rent-agreement-types-india) explain what the agreement should say.",
      },
      {
        type: "note",
        text: "Bhavano checks listings before they go live but does not inspect homes or verify who an owner is. See [what we do and do not check](/trust). Always visit the place and meet the owner yourself.",
      },
      {
        type: "p",
        text: "Looking now? Browse [apartments for rent](/rent-lease/apartment), use the [rent affordability calculator](/tools/rent-affordability-calculator) to set a budget, and walk through the [flat viewing checklist](/blog/flat-viewing-checklist) on every visit. If you own a home, you can [list it on Bhavano](/post).",
      },
    ],
  },
  {
    slug: "owner-direct-vs-broker-listings",
    title: "Owner-direct listings vs broker listings: how to choose and what changes for you",
    description:
      "What an owner-direct listing is, how it differs from a broker listing, the pros and cons of each for tenants and buyers, and the checks that apply either way.",
    published: "2026-11-01",
    format: "Comparison",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "An owner-direct listing is posted by the person who owns the property, so you deal with them from the first message. A broker listing is posted by an agent who acts between you and the owner. Neither is automatically better. Owner-direct usually means no brokerage and a direct conversation, while a broker can save time, show many options and handle paperwork for a fee.",
      },
      { type: "h2", text: "What is the difference between an owner-direct and a broker listing?" },
      {
        type: "ul",
        items: [
          "Who you talk to: the owner, or an agent who may or may not have the owner's full authority.",
          "Cost: with an owner you usually pay no brokerage; with a broker, brokerage is normally agreed up front, so ask who pays it and when.",
          "Information: an owner knows the home's history, the neighbours and the building; an agent knows the market but may know less about this one home.",
          "Speed: a broker may line up several visits in a day; an owner will show only their own home.",
          "Negotiation: with an owner you negotiate directly; a broker sits in the middle, which can help or slow things down.",
        ],
      },
      { type: "h2", text: "When is owner-direct the better choice?" },
      {
        type: "p",
        text: "When you have time to visit, you know the area, you are comfortable asking questions and you want to avoid brokerage. It also suits buyers who want to hear why the owner is selling, and tenants who want a landlord they can speak to directly. Owners benefit too: they choose their own tenant and keep control of the price.",
      },
      { type: "h2", text: "When is a broker worth using?" },
      {
        type: "p",
        text: "When you are new to the city, short of time, or looking for something specific that is not listed. A good broker narrows the field and explains local practice. If you use one, agree the fee in writing before you start and check the broker's own identity too.",
      },
      { type: "h2", text: "What should I check, whichever kind of listing it is?" },
      {
        type: "ol",
        items: [
          "Visit in person and see the exact home, not a sample.",
          "Confirm who owns it. See [how to verify an owner](/blog/verify-property-owner-before-paying-token) and, for a purchase, [how to check the title is clear](/blog/how-to-check-property-title-is-clear).",
          "Compare the photos and details with what you see. See [how to spot a bad property ad](/blog/spotting-a-bad-property-ad).",
          "Get every amount and promise in writing before you pay.",
          "Never pay a token or deposit for a place you have not seen.",
        ],
      },
      { type: "h2", text: "How does Bhavano fit in?" },
      {
        type: "p",
        text: "Bhavano is a marketplace where owners, builders and managers post their own listings, and you contact them through the site. Listings are checked before they go live, but Bhavano does not inspect properties or verify ownership. Read [our trust page](/trust) for exactly what is and is not checked. Every site has its own policy on who may post and what it charges, so read each one's rules before you rely on it.",
      },
      {
        type: "p",
        text: "Start with [apartments for rent](/rent-lease/apartment), [apartments for sale](/buy/apartment) or [PG listings](/pg), or read [how to rent without a broker](/blog/rent-a-house-without-a-broker-india).",
      },
    ],
  },
  {
    slug: "police-verification-and-tenant-documents-for-landlords",
    title: "Police verification and documents to ask from a tenant: a landlord's checklist",
    description:
      "Which papers a landlord can reasonably ask from a tenant, what police verification is and why it matters, and how to keep records safely. Rules vary by state.",
    published: "2026-11-01",
    format: "Checklist",
    readingMinutes: 5,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. Whether and how tenant details must be given to the police differs by state and city and changes over time. Check your local police website or ask a lawyer.",
      },
      { type: "h2", text: "What documents should a landlord ask from a tenant?" },
      {
        type: "p",
        text: "Ask for proof of identity, proof of work or study, and proof of the tenant's permanent address. Then keep copies safely. Ask only for what you need, because these papers contain personal data that you are responsible for.",
      },
      {
        type: "ul",
        items: [
          "Government photo ID: a document such as Aadhaar, passport, driving licence or voter ID. Check the name and photo against the person in front of you.",
          "Proof of work or study: an employment letter, company ID, or college ID and letter.",
          "Permanent address proof, and the contact details of a parent, employer or other reference.",
          "Recent photographs and a working mobile number.",
          "For a family, the names and ages of everyone who will live in the home.",
        ],
      },
      { type: "h2", text: "What is police verification of a tenant?" },
      {
        type: "p",
        text: "In many states and cities, a landlord is expected, or required, to send the tenant's details to the local police station. Some places have an online form on the state police website, and others use a paper form. The purpose is to have a record of who lives where. If the form is mandatory where you live, skipping it can create trouble for you if the tenant is later involved in an offence.",
      },
      { type: "h2", text: "How do I do it?" },
      {
        type: "ol",
        items: [
          "Find the local police website or tenant registration page for your city, or ask at the nearest police station.",
          "Fill in the form with the tenant's details and attach the ID copies it asks for.",
          "Keep the acknowledgement or receipt with your copy of the rent agreement.",
          "Do it before or soon after the tenant moves in, not months later.",
        ],
      },
      { type: "h2", text: "What else protects me as a landlord?" },
      {
        type: "ul",
        items: [
          "A signed rent agreement that names the tenant and lists every occupant. See [rent agreement types in India](/blog/rent-agreement-types-india).",
          "The deposit and rent recorded by bank transfer, with receipts. See [how a security deposit works](/blog/security-deposit-for-rent-in-india).",
          "A dated move-in inventory with photos, signed by both of you.",
          "A rule that sub-letting needs your written consent.",
          "Sensible handling of the copies: store them securely and do not share them with anyone who has no need.",
        ],
      },
      {
        type: "p",
        text: "Need a tenant? Read [how to find reliable tenants](/blog/how-to-find-reliable-tenants), and when you are ready, [post your property on Bhavano](/post).",
      },
    ],
  },
  {
    slug: "rent-agreement-types-india",
    title: "Which rent agreement should you sign in India: 11-month, leave and license, or lease",
    description:
      "The difference between an 11-month rent agreement, a leave and license agreement and a registered lease, why 11 months is common, and what each should contain.",
    published: "2026-11-01",
    format: "Explainer",
    readingMinutes: 5,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. Tenancy and registration rules are set by each state and change. Ask a local lawyer or the sub-registrar's office before you sign.",
      },
      { type: "h2", text: "What are the main types of rental agreement in India?" },
      {
        type: "p",
        text: "There are three you will meet most. A short rent agreement, often written for 11 months, is the everyday choice for homes. A leave and license agreement gives the occupier permission to use the home without creating a tenancy, and is common in some states, especially in the west of India. A registered lease is a longer, formal agreement, more often used for commercial space or long residential terms. Which names and forms are used depends on the state.",
      },
      { type: "h2", text: "Why is an 11-month agreement so common?" },
      {
        type: "p",
        text: "In general, a lease of a year or more must be registered, which brings registration charges and stamp duty into it. A term below that can often be done on stamp paper without registering, so many owners and tenants use 11 months and renew. Check the rule in your state, and see [stamp duty and registration charges](/blog/stamp-duty-and-registration-charges-explained) for how the charges work.",
      },
      { type: "h2", text: "What is the difference between rent, leave and license, and lease?" },
      {
        type: "ul",
        items: [
          "Rent agreement: a tenancy for a stated period, usually with a rent, a deposit and a notice period. Some tenant protections under local rent laws may apply.",
          "Leave and license: a licence to occupy for a fixed period. The licensor keeps possession in law, and the tenant-protection rules may not apply in the same way.",
          "Lease: a longer transfer of the right to use the property for a stated term, normally registered.",
        ],
      },
      { type: "h2", text: "What should any rental agreement contain?" },
      {
        type: "ol",
        items: [
          "The full names and addresses of the owner and the tenant, and the address of the property.",
          "The start date, the term and how it can be renewed or ended.",
          "The rent, the due date, how it is paid and how it can change at renewal.",
          "The deposit, what can be deducted and when it is returned.",
          "Who pays for maintenance, repairs, utilities and society charges.",
          "The notice period and the lock-in, if any, for both sides.",
          "Rules on sub-letting, use of the home and the number of occupants.",
          "Signatures of both sides and, where needed, witnesses.",
        ],
      },
      { type: "h2", text: "Should I register the agreement?" },
      {
        type: "p",
        text: "Registration gives a stronger record if there is a dispute and is required for longer terms. Even an unregistered short agreement is worth having, because it records what you both agreed. Read [rental agreement questions](/blog/rental-agreement-questions) and [security deposit in India](/blog/security-deposit-for-rent-in-india), and start your search with [homes for rent](/rent-lease/apartment).",
      },
    ],
  },
  {
    slug: "pg-vs-co-living-vs-renting-a-flat",
    title: "PG vs co-living vs renting a flat: which is better for a student or a new job?",
    description:
      "How a PG, a co-living space and a rented flat differ on flexibility, privacy, upkeep and set-up effort, and which suits a student, a new joiner or a sharer.",
    published: "2026-11-01",
    format: "Comparison",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "A PG is the quickest and simplest, a rented flat gives the most privacy and control, and co-living sits between them. If you are new to a city and want to move in within days, start with a PG or co-living. If you will stay for a year or more and want your own space, a flat, often shared with others, is usually the better fit.",
      },
      { type: "h2", text: "What is the difference between a PG, co-living and a flat?" },
      {
        type: "ul",
        items: [
          "PG (paying guest): a room, usually shared, in someone's home or a building, often with meals and housekeeping. Rules such as curfew and visitors are set by the owner.",
          "Co-living: a managed shared home or building with furnished rooms, common areas, services and usually a standard contract. Often more structured than a PG.",
          "Rented flat: you rent the whole home from the owner, set it up and run it yourself, alone or with flatmates.",
        ],
      },
      { type: "h2", text: "How do they compare?" },
      {
        type: "ul",
        items: [
          "Set-up effort: a PG and co-living are furnished and ready; a flat needs furniture, appliances, internet and utility connections.",
          "Flexibility: a PG and co-living usually have shorter notice periods; a flat usually has an agreement of several months, a deposit and a notice period.",
          "Privacy: a flat gives the most; PG rooms are often shared; co-living varies.",
          "Food and upkeep: often included in a PG and co-living; in a flat you cook, clean and handle repairs.",
          "Rules: a PG may have a curfew and visitor limits; a flat has the rules of your agreement and the society.",
          "Paperwork: a flat needs a rent agreement and often a bigger deposit. See [security deposit in India](/blog/security-deposit-for-rent-in-india).",
        ],
      },
      { type: "h2", text: "Which suits a student, a new joiner or a sharer?" },
      {
        type: "p",
        text: "A student with no kitchen and little time usually does well in a PG near college. A new joiner who is still learning the city can start in a PG or co-living, then move to a flat once the commute and neighbourhood are clear. Two or three friends or colleagues who want privacy and control often prefer to share a flat, which needs a clear agreement on who pays what.",
      },
      { type: "h2", text: "What should I check before choosing?" },
      {
        type: "p",
        text: "Whatever you pick, see it in person, ask for every charge in writing and test the commute. Use the [PG hunting checklist](/blog/pg-hunting-checklist), the [women-only PG checklist](/blog/womens-pg-checklist) or the [flat viewing checklist](/blog/flat-viewing-checklist). Compare options in [PG listings](/pg) and [apartments for rent](/rent-lease/apartment), and read the [guide to moving to a new city](/moving-to-a-new-city).",
      },
      {
        type: "note",
        text: "Bhavano does not inspect PGs, co-living spaces or flats. See [what we do and do not check](/trust).",
      },
    ],
  },
  {
    slug: "property-registration-process-india",
    title: "Property registration in India step by step: from agreement to mutation",
    description:
      "What happens after you agree to buy a property: stamp duty, sub-registrar visit, registered sale deed, mutation or khata transfer and updating utilities.",
    published: "2026-11-01",
    format: "Guide",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. Procedures, forms and fees differ by state and change. Confirm each step with your lawyer and the state registration department.",
      },
      { type: "h2", text: "What are the steps to register a property in India?" },
      {
        type: "p",
        text: "In outline, you check the title, sign an agreement to sell, pay stamp duty and registration charges, register the sale deed at the sub-registrar's office, and then get the property transferred in the municipal or revenue records. The sale is complete in law when the sale deed is registered, and the later steps update the records so the property stands in your name.",
      },
      { type: "h2", text: "Step by step" },
      {
        type: "ol",
        items: [
          "Check the title and approvals before paying a large amount. See [how to check the title is clear](/blog/how-to-check-property-title-is-clear) and the [documents checklist](/blog/property-approvals-documents-checklist).",
          "Sign an agreement to sell that records the price, payment schedule, possession date and who bears which cost.",
          "Work out and pay stamp duty and registration charges as your state requires, often online. See [stamp duty and registration charges](/blog/stamp-duty-and-registration-charges-explained).",
          "Draft the sale deed with your lawyer. Both sides read it fully before the day.",
          "Book a slot at the sub-registrar's office. In many states, this is done online.",
          "On the day, the buyer, the seller and the witnesses attend with their original ID and photographs. Details are recorded and the deed is signed, usually with a photograph and fingerprints.",
          "Collect the registered deed, or the receipt and the date it will be ready.",
          "Apply for mutation or khata transfer so the municipal or revenue records show you as the owner.",
          "Update property tax, electricity, water and society records in your name.",
        ],
      },
      { type: "h2", text: "What are mutation and khata transfer?" },
      {
        type: "p",
        text: "Registration records the sale, but mutation (in many states) or khata transfer (for example in Bengaluru) puts your name in the local authority's records for tax and services. Skipping it can cause problems when you pay property tax, apply for a loan or sell later. For the Bengaluru khata, read [A khata and B khata](/blog/a-khata-b-khata-bengaluru).",
      },
      { type: "h2", text: "What can go wrong?" },
      {
        type: "ul",
        items: [
          "Paying most of the price before the title has been checked.",
          "A seller without full ownership, or with a loan or dispute on the property.",
          "Under-stating the price to save duty, which is illegal and puts your ownership and loan at risk.",
          "Not completing mutation, so the old owner still appears in the records.",
          "Missing the possession terms in the agreement.",
        ],
      },
      {
        type: "p",
        text: "Budget for the whole cost before you commit. See [how much down payment you need](/blog/down-payment-for-a-home-loan) and the [EMI calculator](/tools/emi-calculator), then browse [apartments for sale](/buy/apartment), [houses for sale](/buy/house) or [plots](/plot).",
      },
    ],
  },
  {
    slug: "buying-property-in-india-as-an-nri",
    title: "Buying property in India as an NRI: eligibility, documents and payment basics",
    description:
      "What an NRI can generally buy in India, the documents needed, how to pay, why a power of attorney needs care, and what to confirm with a professional.",
    published: "2026-11-01",
    format: "Guide",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "General information, not legal, tax or foreign-exchange advice. The rules for non-resident Indians and overseas citizens are set by the Reserve Bank of India and tax law, and they change. Confirm each point with your bank, a lawyer and a tax adviser before you commit.",
      },
      { type: "h2", text: "Can an NRI buy property in India?" },
      {
        type: "p",
        text: "In general, yes. NRIs can usually buy residential and commercial property in India without special permission, subject to the rules of the time. Buying agricultural land, a plantation or a farmhouse is generally restricted. Rules for Overseas Citizens of India (OCI) can differ from those for NRIs, so check which category applies to you.",
      },
      { type: "h2", text: "What documents does an NRI need?" },
      {
        type: "ul",
        items: [
          "A valid passport, plus an OCI card if you hold one, and a visa or residence proof for the country you live in.",
          "An Indian PAN card, which is needed for the purchase and for tax.",
          "An Indian bank account, usually an NRE or NRO account, to pay from.",
          "Address proof in India and abroad, and recent photographs.",
          "For a loan, income proof and employment details from abroad, which lenders may ask for in a specific format.",
        ],
      },
      { type: "h2", text: "How should an NRI pay for the property?" },
      {
        type: "p",
        text: "Pay through normal banking channels from your NRE, NRO or foreign-currency account, and keep every bank record. Do not pay in cash. The source of the funds affects whether you can later send the money back abroad, so ask your bank how the account you use affects that before you pay.",
      },
      { type: "h2", text: "Can someone else buy on my behalf, and what about a power of attorney?" },
      {
        type: "p",
        text: "Many NRIs sign a power of attorney so a relative or lawyer can sign papers in India. It is a powerful document: it lets another person act for you. Use a trusted person, limit it to the specific task and period, execute it as the law of the country you are in and Indian law require, and keep a record of every act done under it. Ask your lawyer about attestation, apostille and registration.",
      },
      { type: "h2", text: "What else should I check?" },
      {
        type: "ol",
        items: [
          "Verify the seller and the title. See [how to check the title is clear](/blog/how-to-check-property-title-is-clear).",
          "If the project is under construction, check its RERA registration. See [RERA explained](/blog/rera-explained-for-home-buyers).",
          "Understand the costs and process. See [stamp duty and registration](/blog/stamp-duty-and-registration-charges-explained) and [the registration steps](/blog/property-registration-process-india).",
          "Understand tax when you later sell. See [capital gains tax on property](/blog/capital-gains-tax-on-property-explained) and [TDS on rent and property](/blog/tds-on-rent-and-property-purchase-india).",
          "Have someone you trust visit the property in person if you cannot.",
        ],
      },
      {
        type: "p",
        text: "To see what is available, browse [apartments for sale](/buy/apartment), [houses](/buy/house) and [plots](/plot), and use the [EMI calculator](/tools/emi-calculator) and the [rent vs buy calculator](/tools/rent-vs-buy-calculator).",
      },
    ],
  },
  {
    slug: "tds-on-rent-and-property-purchase-india",
    title: "TDS on rent and on buying a property in India, in plain words",
    description:
      "When a tenant or a buyer has to deduct tax at source, who deposits it and which records to keep. No rates quoted, so check the current rules for your case.",
    published: "2026-11-01",
    format: "Explainer",
    readingMinutes: 5,
    body: [
      {
        type: "note",
        text: "General information, not tax advice. Thresholds, rates, due dates and forms change often, so this page quotes none of them. Check the current rules on the income tax department's website or with a chartered accountant.",
      },
      { type: "h2", text: "What is TDS?" },
      {
        type: "p",
        text: "TDS is tax deducted at source. Instead of the receiver paying all of the tax later, the person making the payment holds back a part, deposits it with the government and gives the receiver credit for it. For property, it comes up in two places: rent, and the purchase of a property.",
      },
      { type: "h2", text: "Do I have to deduct TDS when I pay rent?" },
      {
        type: "p",
        text: "It depends on who you are and how much rent you pay. Businesses and people whose accounts are audited have one rule. Individuals and Hindu undivided families who are not audited have a separate rule that applies only once monthly rent crosses a stated threshold. If you pay rent below the threshold, no deduction is needed. Look up the current threshold for your year before you decide.",
      },
      { type: "h2", text: "What does a tenant do if TDS applies?" },
      {
        type: "ol",
        items: [
          "Work out whether the rent crosses the threshold and when the duty to deduct starts.",
          "Deduct the tax from the rent as the law says, or at the point the rule specifies.",
          "Deposit it with the government by the due date through the tax portal.",
          "File the required statement and give the landlord the proof so they can claim the credit.",
          "Keep the receipts together with the rent agreement.",
        ],
      },
      { type: "h2", text: "What about TDS when I buy a property?" },
      {
        type: "p",
        text: "When you buy a property from a resident seller for more than a stated value, the buyer generally has to deduct tax at source from the price and deposit it, not the seller. The tax is on the price, and the buyer pays the seller the balance. You usually need the seller's PAN, and the buyer files a form and gives the seller the certificate. Purchases from non-resident sellers follow different rules.",
      },
      { type: "h2", text: "What happens if TDS is missed?" },
      {
        type: "ul",
        items: [
          "The payer can be charged interest and a late fee for deducting or depositing late.",
          "The receiver may not get credit for the tax in their return.",
          "The payer can face a penalty for not deducting at all.",
        ],
      },
      {
        type: "p",
        text: "If you are a landlord, record the rent clearly. See [rent agreement types](/blog/rent-agreement-types-india) and [how to calculate rental yield](/blog/how-to-calculate-rental-yield). If you are buying, read [stamp duty and registration](/blog/stamp-duty-and-registration-charges-explained) and [the registration steps](/blog/property-registration-process-india). If you are selling, read [capital gains tax on property](/blog/capital-gains-tax-on-property-explained).",
      },
    ],
  },
  {
    slug: "how-to-choose-an-area-to-live-in-bengaluru",
    title: "How to choose an area to live in Bengaluru: by commute, not by hype",
    description:
      "A commute-first way to choose where to rent or buy in Bengaluru: the main work corridors, the areas near each, and what to check on traffic and amenities.",
    published: "2026-11-01",
    format: "City guide",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "In Bengaluru, choose the area by your daily commute first, because traffic can matter more than the distance on a map. Pick the corridor where you work, shortlist the neighbourhoods close to it, and test the journey at your real travel time before you commit to a lease or a purchase.",
      },
      { type: "h2", text: "Which areas are near which work corridor?" },
      {
        type: "ul",
        items: [
          "Outer Ring Road (Bellandur, Marathahalli, Sarjapur Road and nearby): a large cluster of tech parks, with many apartment communities around it.",
          "Whitefield and ITPL: in the east, with large gated communities and its own cluster of offices.",
          "Electronic City: in the south, with offices and housing built for the people who work there.",
          "Koramangala, HSR Layout and BTM Layout: central-south, popular with people who want cafes, shops and a mix of homes and PGs close by.",
          "Indiranagar and Domlur: central-east, close to the older city and the metro.",
          "North Bengaluru (Hebbal, Yelahanka and nearby): near the airport road and growing residential areas.",
        ],
      },
      { type: "h2", text: "What should I check for each area?" },
      {
        type: "ol",
        items: [
          "The commute at your actual hour, by your actual mode: car, two-wheeler, bus or metro. Try it on a weekday.",
          "Flooding and waterlogging in the rains, which hits some low-lying stretches. Ask residents.",
          "Water supply: some areas rely on tankers or borewells for part of the year. Ask what the building uses.",
          "Distance to a metro or bus stop, a pharmacy, a clinic and daily shops.",
          "The kind of housing on offer: gated apartments, independent houses, PGs or villas.",
        ],
      },
      { type: "h2", text: "If I am buying, what else matters?" },
      {
        type: "p",
        text: "Check the khata and the layout approval, because they decide whether you can get a loan and sell later. Read [A khata and B khata in Bengaluru](/blog/a-khata-b-khata-bengaluru), [BDA-approved sites](/blog/bda-approved-sites-bengaluru) and [RERA explained](/blog/rera-explained-for-home-buyers).",
      },
      { type: "h2", text: "How do I shortlist on Bhavano?" },
      {
        type: "p",
        text: "Open [Bengaluru](/bengaluru), choose a category and an area, and compare listings side by side. Use the [PG listings](/pg) for a room, [apartments for rent](/rent-lease/apartment) for a flat and [apartments for sale](/buy/apartment) to buy. Then walk through the [flat viewing checklist](/blog/flat-viewing-checklist). New to the city? See [moving to a new city](/moving-to-a-new-city).",
      },
    ],
  },
  {
    slug: "how-to-choose-an-area-to-live-in-hyderabad",
    title: "How to choose an area to live in Hyderabad: by work corridor and commute",
    description:
      "Where people live in Hyderabad relative to the main work areas, what to check on commute, water and approvals, and how to shortlist homes and PGs.",
    published: "2026-11-01",
    format: "City guide",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "In Hyderabad, start from where you work. The big job clusters are in the west of the city, and the commute between home and office, especially at peak hours, should decide your area. Shortlist neighbourhoods near your corridor, then test the journey before you sign.",
      },
      { type: "h2", text: "Which areas are near which work corridor?" },
      {
        type: "ul",
        items: [
          "HITEC City, Madhapur and Kondapur: the main tech cluster, with many apartments and PGs close by.",
          "Gachibowli, Financial District and Nanakramguda: offices and large apartment communities in the west and south-west.",
          "Kukatpally, KPHB and Miyapur: a large residential belt in the north-west, connected by the metro to other parts of the city.",
          "Banjara Hills and Jubilee Hills: established central-west areas with a mix of independent houses and apartments.",
          "Secunderabad and Begumpet: older, central-north areas with good public transport.",
          "Uppal, LB Nagar and the east: residential areas that are farther from the western job clusters.",
        ],
      },
      { type: "h2", text: "What should I check?" },
      {
        type: "ol",
        items: [
          "The commute at peak hour by your own mode of transport. The same distance can take very different times in the morning and evening.",
          "Whether a metro or bus route serves both your home and your office.",
          "Water supply: ask what the building depends on and whether tankers are needed in summer.",
          "Waterlogging on the approach roads after heavy rain.",
          "The kind of housing and who it is for: gated communities, standalone buildings or PGs.",
        ],
      },
      { type: "h2", text: "If I am buying, what else matters?" },
      {
        type: "p",
        text: "Check the project's RERA registration and the layout approval for plots, and see the title papers before paying. Read [RERA explained](/blog/rera-explained-for-home-buyers), [DTCP-approved plots](/blog/dtcp-approved-plots-explained) and [how to check the title is clear](/blog/how-to-check-property-title-is-clear).",
      },
      { type: "h2", text: "How do I shortlist on Bhavano?" },
      {
        type: "p",
        text: "Open [Hyderabad](/hyderabad), pick a category and an area, and compare listings. Use [PG listings](/pg) for a room and [apartments for rent](/rent-lease/apartment) for a flat. Then use the [flat viewing checklist](/blog/flat-viewing-checklist) and the [guide to moving to a new city](/moving-to-a-new-city).",
      },
    ],
  },
  {
    slug: "how-to-choose-an-area-to-live-in-chennai",
    title: "How to choose an area to live in Chennai: by commute, rain and rail",
    description:
      "How to pick where to rent or buy in Chennai: the main work corridors, the areas near each, and what to check on flooding, water and transport.",
    published: "2026-11-01",
    format: "City guide",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "In Chennai, choose by three things: where you work, how you will travel and how an area copes with heavy rain. The IT corridor runs along the Old Mahabalipuram Road in the south, and many other jobs are in the centre and west. Pick the corridor first, then the neighbourhood.",
      },
      { type: "h2", text: "Which areas are near which work corridor?" },
      {
        type: "ul",
        items: [
          "Old Mahabalipuram Road (OMR): Perungudi, Thoraipakkam, Sholinganallur and Navalur, with tech parks and many apartment communities.",
          "Guindy, Velachery and Adambakkam: south-central areas with good road and suburban rail links to the centre and OMR.",
          "Adyar, Besant Nagar and Mylapore: established southern neighbourhoods near the coast and the older city.",
          "Anna Nagar, Kilpauk and Ashok Nagar: central and north-central areas with a mix of homes and shops.",
          "Porur, Ambattur and the west: growing residential areas, with offices and industrial estates nearby.",
          "Tambaram, Chromepet and the far south: reachable by suburban rail, with a mix of apartments and houses.",
        ],
      },
      { type: "h2", text: "What should I check?" },
      {
        type: "ol",
        items: [
          "Flooding history. Ask residents and neighbours how the street fared in heavy rain, and check the ground floor and parking in particular.",
          "The commute at peak hour, and whether a metro or suburban rail station is near both ends of your journey.",
          "Water supply and quality: ask what the building uses and whether it needs tankers in summer.",
          "Distance to a pharmacy, a clinic and daily shopping.",
          "The kind of housing on offer: gated apartments, independent houses or PGs.",
        ],
      },
      { type: "h2", text: "If I am buying, what else matters?" },
      {
        type: "p",
        text: "Check the project's RERA registration and the layout approval, and look at the title papers before paying. Read [RERA explained](/blog/rera-explained-for-home-buyers), [DTCP-approved plots](/blog/dtcp-approved-plots-explained) and the [documents checklist](/blog/property-approvals-documents-checklist).",
      },
      { type: "h2", text: "How do I shortlist on Bhavano?" },
      {
        type: "p",
        text: "Open [Chennai](/chennai), choose a category and an area and compare listings, or go straight to the [PG listings in Chennai](/chennai/pg). Use [apartments for rent](/rent-lease/apartment) for a flat, and the [flat viewing checklist](/blog/flat-viewing-checklist) on every visit. New to the city? Read [moving to a new city](/moving-to-a-new-city).",
      },
    ],
  },
  {
    slug: "how-to-choose-an-area-to-live-in-pune",
    title: "How to choose an area to live in Pune: by work hub and traffic",
    description:
      "Where people live in Pune relative to the main work hubs, how to judge traffic and amenities, and how to shortlist homes and PGs for rent or purchase.",
    published: "2026-11-01",
    format: "City guide",
    readingMinutes: 5,
    body: [
      {
        type: "p",
        text: "In Pune, choose the area by your work hub and by how the roads and public transport serve it. The large IT and business hubs are in the west and east, and travel between them can be slow at peak times, so living close to where you work matters more than in many other cities.",
      },
      { type: "h2", text: "Which areas are near which work hub?" },
      {
        type: "ul",
        items: [
          "Hinjewadi, Wakad and Baner: in the west, near the large IT park, with many apartments and PGs.",
          "Kharadi, Viman Nagar and Magarpatta: in the east, with offices, large apartment communities and the airport nearby.",
          "Aundh, Balewadi and Pashan: north-west areas, with a mix of established and newer housing.",
          "Kothrud, Karve Nagar and Erandwane: older west-central neighbourhoods, popular with families and students.",
          "Camp, Koregaon Park and Shivajinagar: central areas with a mix of older and newer buildings and easy access to the city.",
          "Hadapsar, Kondhwa and Wanowrie: south-east, with residential belts and a mix of housing.",
        ],
      },
      { type: "h2", text: "What should I check?" },
      {
        type: "ol",
        items: [
          "The commute at peak hour on a weekday. Some stretches that look short on a map are slow in practice.",
          "Whether a bus or metro route serves both ends of your journey.",
          "Water supply: ask what the building depends on and about summer shortages.",
          "How the area is for students or families: schools, colleges, shops and a clinic nearby.",
          "The kind of housing: gated societies, independent houses, PGs or co-living.",
        ],
      },
      { type: "h2", text: "If I am buying, what else matters?" },
      {
        type: "p",
        text: "Check the project's RERA registration, the approvals and the title before you pay. Read [RERA explained](/blog/rera-explained-for-home-buyers), the [documents checklist](/blog/property-approvals-documents-checklist) and [stamp duty and registration](/blog/stamp-duty-and-registration-charges-explained).",
      },
      { type: "h2", text: "How do I shortlist on Bhavano?" },
      {
        type: "p",
        text: "Open [Pune](/pune), pick a category and an area and compare listings. Use [PG listings](/pg) for a room, [apartments for rent](/rent-lease/apartment) for a flat and [apartments for sale](/buy/apartment) to buy. Then walk through the [flat viewing checklist](/blog/flat-viewing-checklist), and read the [guide to moving to a new city](/moving-to-a-new-city).",
      },
    ],
  },
];
