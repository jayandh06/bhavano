/** The first area overview drafts (Bengaluru), written from general knowledge and NOT yet
 * reviewed. Loaded into the database as drafts by seed-area-overview-drafts.ts; from there they
 * are edited, reviewed and published in the admin app (Area overviews). Keyed by `city/area`
 * slug. Do not treat anything in here as verified. */
import type { AreaOverviewContent } from '@bhavano/types/areaOverview';

export const AREA_OVERVIEW_DRAFTS: Record<string, AreaOverviewContent> = {
  "bengaluru/koramangala": {
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
  "bengaluru/hsr-layout": {
    about: [
      "HSR Layout, named for the Hosur-Sarjapur Road it grew along, is a planned residential neighbourhood in south-east Bengaluru. It is divided into numbered sectors, from Sector 1 to Sector 7, and borders Koramangala, BTM Layout and Bellandur.",
      "It is a popular base for people who work in start-ups and in the office parks along the Outer Ring Road, and it has a wide range of cafés, restaurants and everyday shops. Homes are mostly apartments and independent houses.",
    ],
    gettingAround: [
      "The Outer Ring Road runs along its northern edge and Hosur Road is close by, which makes it convenient for offices in south and east Bengaluru. Peak-hour traffic near the Silk Board junction is heavy, so test your commute at the time you would actually travel.",
    ],
    faqs: [
      {
        question: "What are the sectors in HSR Layout?",
        answer:
          "HSR Layout is divided into Sector 1 to Sector 7. Listings often name a sector, and prices and surroundings can differ between them, so check the exact sector before you shortlist.",
      },
      {
        question: "Who usually rents in HSR Layout?",
        answer:
          "Many tenants are working professionals, often sharing a flat. Ask the owner or agent about any rules on sharing, visitors and pets before you commit.",
      },
      {
        question: "How do I check a HSR Layout listing is genuine?",
        answer:
          "See the place in person, meet the person who will sign the agreement, and get the terms in writing before you pay. Bhavano checks listings before they go live but does not inspect properties.",
      },
    ],
  },
  "bengaluru/mg-road": {
    about: [
      "MG Road, short for Mahatma Gandhi Road, is part of central Bengaluru's business district. It sits close to Brigade Road, Trinity Circle and Cubbon Park, and it is one of the city's best-known commercial and shopping streets.",
      "The stretch is mostly offices, hotels, shops and restaurants, with residential apartments in and around it. People who look here often want a short walk to work or easy access to the rest of the city.",
    ],
    gettingAround: [
      "The area has an MG Road station on the Namma Metro Purple Line, and it is well connected by bus and road to the rest of the city. Check current metro timings and routes before you plan a daily commute around them.",
    ],
    faqs: [
      {
        question: "Is MG Road mostly commercial or residential?",
        answer:
          "It is mainly commercial, with offices, shops and hotels. Residential options exist in the streets around it, so look at the exact address in a listing to see how close it is to the main road.",
      },
      {
        question: "What kind of property is available around MG Road?",
        answer:
          "Where listings are available, you can browse apartments, commercial space and coworking desks. Use the filters on this page to narrow by type and budget.",
      },
      {
        question: "What should I check before renting a commercial space?",
        answer:
          "Ask about the lease term, who pays maintenance and parking, and what the notice period is, and get everything in writing. Read our guide on questions to ask before signing a rental agreement.",
      },
    ],
  },
  "bengaluru/jayanagar": {
    about: [
      "Jayanagar is an established residential neighbourhood in south Bengaluru, laid out in numbered blocks from the 1st Block to the 9th Block. It is known for its tree-lined streets, long-standing homes and busy local markets.",
      "Many families live here, and the area has schools, hospitals, parks and shopping close to the residential streets. Homes include independent houses, older apartment buildings and newer low-rise apartments.",
    ],
    gettingAround: [
      "Several main roads connect Jayanagar to the centre of Bengaluru and to nearby south Bengaluru areas, and there is a metro line running through the south of the city. Check the current station nearest the block you are considering.",
    ],
    faqs: [
      {
        question: "What are the blocks in Jayanagar?",
        answer:
          "Jayanagar is divided into numbered blocks, from the 1st Block to the 9th Block. Each block has its own character, so look at the specific block in a listing and visit it before you decide.",
      },
      {
        question: "Is Jayanagar suited to families?",
        answer:
          "It is an established family neighbourhood with schools, hospitals and parks nearby. Whether a particular street suits you depends on noise, parking and distance to work, so visit at different times of day.",
      },
      {
        question: "How do I check a Jayanagar listing is genuine?",
        answer:
          "See the property in person, confirm who owns it and who signs the agreement, and keep every payment on record. Bhavano checks listings before they go live but does not inspect properties.",
      },
    ],
  },
  "bengaluru/whitefield": {
    about: [
      "Whitefield is a large neighbourhood in east Bengaluru, known for its IT parks and technology offices. It has grown from an older settlement into a mix of gated communities, apartment complexes, independent houses and shopping areas.",
      "People who work in the IT parks often look here to live close to work. The area is spread out, so how far a listing is from the main road and the offices makes a real difference to daily life.",
    ],
    gettingAround: [
      "Whitefield is on the eastern side of the city, and getting to central Bengaluru can take a long time at peak hours. Check the current road and metro connections, and try the commute at your usual travel time before you decide.",
    ],
    faqs: [
      {
        question: "Is Whitefield a good place to live if I work in an IT park?",
        answer:
          "Many people live in Whitefield to be close to the IT parks. Distance to your own office matters more than the area name, so measure the route and the travel time for your workplace.",
      },
      {
        question: "What types of home are available in Whitefield?",
        answer:
          "Where listings are available, you can browse apartments, villas and houses, and PG rooms. Use the filters on this page to narrow by type, BHK and budget.",
      },
      {
        question: "What should I ask about a gated community?",
        answer:
          "Ask what the monthly maintenance covers, how visitors and parking are handled, and what the society rules are on pets and sub-letting. Get the answers in writing.",
      },
    ],
  },
  "bengaluru/sarjapura": {
    about: [
      "Sarjapura is a growing area on the south-eastern edge of Bengaluru, along Sarjapur Road. It has newer apartment communities, villa projects and plots, and it is further out than Bellandur and HSR Layout.",
      "Because it is farther from the city centre, it appeals to people looking for newer homes and more space, and who are comfortable with a longer commute.",
    ],
    gettingAround: [
      "Sarjapur Road links the area to Bellandur, the Outer Ring Road and the rest of south-east Bengaluru. Traffic on this road is heavy at peak hours, so check the commute to your office before you commit to a location.",
    ],
    faqs: [
      {
        question: "Where is Sarjapura in Bengaluru?",
        answer:
          "Sarjapura is on the south-eastern edge of the city, along Sarjapur Road, beyond areas such as Bellandur. Treat the distance to your workplace as a first filter when you shortlist.",
      },
      {
        question: "What can I find in Sarjapura on Bhavano?",
        answer:
          "Where listings are available, you can browse apartments, villas, plots and houses. Use the filters on this page to narrow by type, BHK and budget.",
      },
      {
        question: "What should I check before buying a plot?",
        answer:
          "Check the ownership documents and the approvals for the layout, and have a lawyer read them before you pay. This is general information, not legal advice.",
      },
    ],
  },
  "bengaluru/indiranagar": {
    about: [
      "Indiranagar is a well-known neighbourhood in east-central Bengaluru, divided into the 1st Stage and the 2nd Stage. It is known for its cafés, restaurants and shops along 100 Feet Road and CMH Road.",
      "It is a mix of older independent houses, low-rise apartments and newer buildings, and it attracts working professionals who want a lively area close to the city centre.",
    ],
    gettingAround: [
      "Indiranagar has an Indiranagar station on the Namma Metro Purple Line, and main roads connect it to the centre and to the east of the city. Check current metro timings and plan the commute at the hours you will travel.",
    ],
    faqs: [
      {
        question: "What are the stages in Indiranagar?",
        answer:
          "Indiranagar is divided into the 1st Stage and the 2nd Stage. Each has its own feel, and the streets near the main roads are busier than the inner ones, so visit before you decide.",
      },
      {
        question: "Is Indiranagar noisy?",
        answer:
          "The streets close to the main roads, restaurants and bars can be busy, especially in the evenings. Visit at different times of day and ask residents about noise on that particular street.",
      },
      {
        question: "How do I check an Indiranagar listing is genuine?",
        answer:
          "See the place in person, meet the person who will sign the agreement, and get the terms in writing before you pay. Bhavano checks listings before they go live but does not inspect properties.",
      },
    ],
  },
  "bengaluru/bellandur": {
    about: [
      "Bellandur is a neighbourhood in south-east Bengaluru, close to the Outer Ring Road and Sarjapur Road. It is known for its large apartment communities and for the lake that shares its name.",
      "Many residents work in the offices along the Outer Ring Road, so the area is popular with working professionals and families who want to live near their workplace.",
    ],
    gettingAround: [
      "The Outer Ring Road and Sarjapur Road both pass close to Bellandur and connect it to HSR Layout, Marathahalli and the rest of the south-east of the city. Traffic on both roads is heavy at peak hours, so test the route at your usual travel time.",
    ],
    faqs: [
      {
        question: "Where is Bellandur in Bengaluru?",
        answer:
          "Bellandur is in south-east Bengaluru, between HSR Layout and Marathahalli, close to the Outer Ring Road and Sarjapur Road.",
      },
      {
        question: "What types of homes are available in Bellandur?",
        answer:
          "Where listings are available, you can browse apartments and houses, and PG rooms. Use the filters on this page to narrow by type, BHK and budget.",
      },
      {
        question: "What should I check about a large apartment community?",
        answer:
          "Ask what the maintenance charge covers, how water and power backup work, and what the rules are on visitors and sub-letting. Get the terms in writing.",
      },
    ],
  },
};
