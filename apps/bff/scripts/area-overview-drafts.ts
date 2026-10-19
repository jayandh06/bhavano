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
  'bengaluru/marathahalli-village': {
    about: [
      'Marathahalli is an established neighbourhood in east Bengaluru, on the Outer Ring Road and on the road that leads towards Whitefield. Marathahalli Village is the older residential part of the area.',
      'It is a busy mix of homes, shops, schools and offices, and many people who work in the technology parks along the Outer Ring Road live here. Homes include apartments, independent houses and PG rooms.',
    ],
    gettingAround: [
      'The Outer Ring Road and the road towards Whitefield meet here, so the area is well connected, but traffic is heavy at peak hours. Check the commute to your office at the time you would actually travel.',
    ],
    faqs: [
      {
        question: 'Where is Marathahalli Village in Bengaluru?',
        answer:
          'It is in east Bengaluru, on the Outer Ring Road, between areas such as Bellandur and the roads leading to Whitefield. It is the older residential part of Marathahalli.',
      },
      {
        question: 'Who usually lives in Marathahalli?',
        answer:
          'Many residents are working professionals who work in nearby offices, along with families who have lived here for years. Ask the owner or agent about any rules on sharing and visitors.',
      },
      {
        question: 'How do I check a Marathahalli listing is genuine?',
        answer:
          'See the property in person, meet the person who will sign the agreement, and get the terms in writing before you pay. Bhavano checks listings before they go live but does not inspect properties.',
      },
    ],
  },
  'kolkata/new-town': {
    about: [
      'New Town is a planned township on the north-eastern side of Kolkata, in the Rajarhat area. It was laid out with wide roads, green spaces and a mix of residential complexes, offices and commercial areas.',
      'It is popular with people who work in the offices and technology parks nearby and with families who want newer apartment complexes. The township is divided into action areas and blocks, so a listing often names the exact one.',
    ],
    gettingAround: [
      'New Town is connected to the rest of Kolkata by main roads and is close to the airport. Because it sits on the edge of the city, check the travel time to the places you visit most before you choose.',
    ],
    faqs: [
      {
        question: 'What is New Town in Kolkata?',
        answer:
          'New Town is a planned township in the Rajarhat area on the north-eastern edge of Kolkata, with residential complexes, offices and public spaces laid out in action areas and blocks.',
      },
      {
        question: 'What kinds of homes are available in New Town?',
        answer:
          'Where listings are available, you can browse apartments, houses, PG rooms and commercial space. Use the filters on this page to narrow by type, BHK and budget.',
      },
      {
        question: 'What should I ask about an apartment complex?',
        answer:
          'Ask what the monthly maintenance covers, how visitors and parking are handled, and what the society rules are on pets and sub-letting. Get the answers in writing.',
      },
    ],
  },
  'kolkata/dum-dum': {
    about: [
      'Dum Dum is an old and busy locality in north Kolkata, close to the city airport. It is mostly residential, with markets, schools and small businesses along its main roads.',
      'Homes here range from older houses and low-rise buildings to newer apartments. People often choose it for its connections to the rest of Kolkata and for the range of options.',
    ],
    gettingAround: [
      'Dum Dum is served by the Kolkata Metro and by several main roads, and it is close to the airport. Check the current station and bus routes nearest the exact address before you commit.',
    ],
    faqs: [
      {
        question: 'Where is Dum Dum in Kolkata?',
        answer:
          'Dum Dum is in north Kolkata, near the city airport. Different parts of the area differ in how busy they are, so look at the exact address in a listing.',
      },
      {
        question: 'Is Dum Dum well connected?',
        answer:
          'It is served by the Kolkata Metro and by main roads. How easy the commute is depends on the specific street and your destination, so test the route at the time you would travel.',
      },
      {
        question: 'How do I check a Dum Dum listing is genuine?',
        answer:
          'See the property in person, confirm who owns it and who signs the agreement, and keep a record of every payment. Bhavano checks listings before they go live but does not inspect properties.',
      },
    ],
  },
  'pune/aundh': {
    about: [
      'Aundh is an established residential neighbourhood in the west of Pune, close to Baner and Pashan and to the university area. It has older streets and newer apartment buildings side by side.',
      'It is popular with families and working professionals because of its shops, schools, hospitals and cafés, and because it is close to several parts of the city.',
    ],
    gettingAround: [
      'Main roads connect Aundh to the centre of Pune, to Baner and to the IT parks on the western side. Traffic is heavy at peak hours, so check the commute to your workplace at the time you would travel.',
    ],
    faqs: [
      {
        question: 'Where is Aundh in Pune?',
        answer:
          'Aundh is in west Pune, near Baner, Pashan and the university area. Look at the exact location in a listing, since parts of the area differ in how busy they are.',
      },
      {
        question: 'What kinds of homes are available in Aundh?',
        answer:
          'Where listings are available, you can browse apartments, houses and PG rooms. Use the filters on this page to narrow by type, BHK and budget.',
      },
      {
        question: 'How do I check an Aundh listing is genuine?',
        answer:
          'See the property in person, meet the person who will sign the agreement, and get the terms in writing before you pay. Bhavano checks listings before they go live but does not inspect properties.',
      },
    ],
  },
  'pune/wakad': {
    about: [
      'Wakad is a fast-growing neighbourhood in the north-west of Pune, next to Pimpri-Chinchwad and close to the Hinjewadi technology park. It has many newer apartment complexes along with shops and schools.',
      'It is popular with people who work in the Hinjewadi area and want a home close to their office, and with families who prefer newer buildings.',
    ],
    gettingAround: [
      'Wakad is close to the Mumbai-Bengaluru bypass and to the roads leading to Hinjewadi and the rest of Pune. Traffic near the main junctions is heavy at peak hours, so test the commute at your usual travel time.',
    ],
    faqs: [
      {
        question: 'Where is Wakad in Pune?',
        answer:
          'Wakad is in north-west Pune, next to Pimpri-Chinchwad and close to the Hinjewadi technology park.',
      },
      {
        question: 'Is Wakad suited to people who work in Hinjewadi?',
        answer:
          'Many residents do, because of the short distance. Measure the route and the travel time for your own office, since peak-hour traffic can change how close it feels.',
      },
      {
        question: 'What should I ask about a newer apartment complex?',
        answer:
          'Ask what the maintenance charge covers, how water and power backup work, and what the rules are on visitors and sub-letting. Get the terms in writing.',
      },
    ],
  },
  'pune/kiwale': {
    about: [
      'Kiwale is a developing locality on the western edge of Pune, in the Pimpri-Chinchwad area, close to the Mumbai-Bengaluru bypass. It has newer residential projects and still has a lot of open land around it.',
      'It appeals to people who want newer homes and more space and who are comfortable with being further from the centre of the city.',
    ],
    gettingAround: [
      'Kiwale is close to the bypass and to the roads towards Pimpri-Chinchwad and Hinjewadi. Because it is further out, check the travel time to your workplace and to the services you use most before you commit.',
    ],
    faqs: [
      {
        question: 'Where is Kiwale in Pune?',
        answer:
          'Kiwale is on the western edge of Pune, in the Pimpri-Chinchwad area, close to the Mumbai-Bengaluru bypass.',
      },
      {
        question: 'What kinds of property can I find in Kiwale?',
        answer:
          'Where listings are available, you can browse apartments, houses and plots. Use the filters on this page to narrow by type, BHK and budget.',
      },
      {
        question: 'What should I check before buying a plot?',
        answer:
          'Check the ownership documents and the approvals for the layout, and have a lawyer read them before you pay. This is general information, not legal advice.',
      },
    ],
  },
  'pune/wagholi': {
    about: [
      'Wagholi is a growing locality on the eastern side of Pune, along the road towards Ahmednagar and close to Kharadi. It has many newer residential projects.',
      'It appeals to people who want newer homes at a distance from the busiest parts of the city, and to those who work in the offices around Kharadi.',
    ],
    gettingAround: [
      'The Pune-Ahmednagar road is the main route in and out of Wagholi, and traffic on it is heavy at peak hours. Check the commute to your workplace at the time you would travel before you decide.',
    ],
    faqs: [
      {
        question: 'Where is Wagholi in Pune?',
        answer:
          'Wagholi is in east Pune, along the Pune-Ahmednagar road, a short distance beyond Kharadi.',
      },
      {
        question: 'What types of home are available in Wagholi?',
        answer:
          'Where listings are available, you can browse apartments and houses, and PG rooms. Use the filters on this page to narrow by type, BHK and budget.',
      },
      {
        question: 'How do I check a Wagholi listing is genuine?',
        answer:
          'See the property in person, confirm who owns it and who signs the agreement, and get the terms in writing. Bhavano checks listings before they go live but does not inspect properties.',
      },
    ],
  },
  'chennai/thoraipakkam': {
    about: [
      'Thoraipakkam is a neighbourhood in south Chennai on the Old Mahabalipuram Road, the city\'s main IT corridor. It has many apartment buildings and is close to several technology offices.',
      'It is popular with people who work in the offices along the corridor and want to live close to work, and it has a good number of shared flats and PG rooms.',
    ],
    gettingAround: [
      'The Old Mahabalipuram Road and the Pallavaram-Thoraipakkam road are the main routes through the area. Peak-hour traffic can be heavy, so test the commute at the time you would travel.',
    ],
    faqs: [
      {
        question: 'Where is Thoraipakkam in Chennai?',
        answer:
          'Thoraipakkam is in south Chennai, on the Old Mahabalipuram Road, which is the city\'s main IT corridor.',
      },
      {
        question: 'Is Thoraipakkam suited to people who work on the IT corridor?',
        answer:
          'Many residents do. Measure the route and the travel time to your own office, since it depends on the exact address and the time of day.',
      },
      {
        question: 'How do I check a Thoraipakkam listing is genuine?',
        answer:
          'See the property in person, meet the person who will sign the agreement, and get the terms in writing before you pay. Bhavano checks listings before they go live but does not inspect properties.',
      },
    ],
  },
  'chennai/porur': {
    about: [
      'Porur is a large neighbourhood in west Chennai, on the Mount-Poonamallee Road, with many apartment communities, shops, hospitals and schools.',
      'It attracts families and working professionals who want a well-served area with a wide range of homes and who are comfortable being further from the sea and the city centre.',
    ],
    gettingAround: [
      'The Mount-Poonamallee Road passes through Porur and links it to the centre of Chennai and to the western suburbs. The Porur junction is busy at peak hours, so check the commute before you commit.',
    ],
    faqs: [
      {
        question: 'Where is Porur in Chennai?',
        answer:
          'Porur is in west Chennai, on the Mount-Poonamallee Road, a little way from the city centre.',
      },
      {
        question: 'What kinds of homes are available in Porur?',
        answer:
          'Where listings are available, you can browse apartments, houses and PG rooms. Use the filters on this page to narrow by type, BHK and budget.',
      },
      {
        question: 'What should I ask about an apartment community?',
        answer:
          'Ask what the maintenance charge covers, how water and power backup work, and what the rules are on visitors and sub-letting. Get the terms in writing.',
      },
    ],
  },
  'hyderabad/gachibowli': {
    about: [
      'Gachibowli is one of Hyderabad\'s main business and technology districts, in the west of the city, close to HITEC City and the Financial District. It has large office parks, apartment towers and gated communities.',
      'It attracts people who work in the technology and finance offices nearby, so many residents are working professionals, and the area has a large share of apartments and shared flats.',
    ],
    gettingAround: [
      'The Outer Ring Road is close, and Gachibowli connects to HITEC City and the rest of Hyderabad by several main roads. Traffic near the office areas is heavy at peak hours, so test the commute at your usual travel time.',
    ],
    faqs: [
      {
        question: 'Where is Gachibowli in Hyderabad?',
        answer:
          'Gachibowli is in west Hyderabad, close to HITEC City, the Financial District and the Outer Ring Road.',
      },
      {
        question: 'Is Gachibowli suited to people who work in the nearby offices?',
        answer:
          'Many residents do. Measure the route and travel time for your own office, since the exact address and the time of day change how far it feels.',
      },
      {
        question: 'What should I ask about a gated community?',
        answer:
          'Ask what the monthly maintenance covers, how visitors and parking are handled, and what the rules are on pets and sub-letting. Get the answers in writing.',
      },
    ],
  },
  'hyderabad/bachupally': {
    about: [
      'Bachupally is a growing neighbourhood in the north-west of Hyderabad, close to Miyapur and Kukatpally and to the Outer Ring Road. It has many newer apartment and villa communities.',
      'It appeals to families and working professionals who want newer homes at a distance from the busiest parts of the city.',
    ],
    gettingAround: [
      'The Outer Ring Road and the roads towards Kukatpally and Miyapur connect Bachupally to the rest of Hyderabad. Because it is on the outskirts, check the travel time to your workplace before you decide.',
    ],
    faqs: [
      {
        question: 'Where is Bachupally in Hyderabad?',
        answer:
          'Bachupally is in north-west Hyderabad, close to Miyapur, Kukatpally and the Outer Ring Road.',
      },
      {
        question: 'What kinds of homes are available in Bachupally?',
        answer:
          'Where listings are available, you can browse apartments, villas and houses. Use the filters on this page to narrow by type, BHK and budget.',
      },
      {
        question: 'How do I check a Bachupally listing is genuine?',
        answer:
          'See the property in person, confirm who owns it and who signs the agreement, and get the terms in writing. Bhavano checks listings before they go live but does not inspect properties.',
      },
    ],
  },
  'mumbai/malad': {
    about: [
      'Malad is a large suburb in the north-west of Mumbai, divided by the railway line into Malad West and Malad East. It has dense residential areas, markets, malls, offices and a long stretch of road along the Link Road.',
      'It attracts working professionals and families who want a well-connected suburb with a wide range of homes and shops.',
    ],
    gettingAround: [
      'Malad is on the Western Line of Mumbai\'s suburban railway and on the Western Express Highway and Link Road, so it is well connected. Check which side of the railway line a listing is on, since it changes how you reach the station.',
    ],
    faqs: [
      {
        question: 'What is the difference between Malad West and Malad East?',
        answer:
          'The railway line divides Malad into West and East, and each side has its own character and its own routes. Check the exact side of a listing and how far it is from the station.',
      },
      {
        question: 'Is Malad well connected?',
        answer:
          'It is on the Western Line and on the main highways. How easy your commute is depends on the exact address and where you work, so test the route at the time you would travel.',
      },
      {
        question: 'How do I check a Malad listing is genuine?',
        answer:
          'See the property in person, meet the person who will sign the agreement, and keep a record of every payment. Bhavano checks listings before they go live but does not inspect properties.',
      },
    ],
  },
  'delhi-ncr/dlf-phase-5': {
    about: [
      'DLF Phase 5 is a residential neighbourhood in Gurugram, close to Golf Course Road. It has gated communities, apartment towers and independent houses.',
      'It attracts working professionals and families who want to live near the offices and shopping areas along Golf Course Road.',
    ],
    gettingAround: [
      'Golf Course Road links the area to other parts of Gurugram and to Delhi, and traffic on it is heavy at peak hours. Check the commute to your workplace at the time you would travel before you decide.',
    ],
    faqs: [
      {
        question: 'Where is DLF Phase 5?',
        answer:
          'DLF Phase 5 is a residential area in Gurugram, close to Golf Course Road.',
      },
      {
        question: 'What kinds of homes are available in DLF Phase 5?',
        answer:
          'Where listings are available, you can browse apartments and houses. Use the filters on this page to narrow by type, BHK and budget.',
      },
      {
        question: 'What should I ask about a gated community?',
        answer:
          'Ask what the monthly maintenance covers, how visitors and parking are handled, and what the rules are on pets and sub-letting. Get the answers in writing.',
      },
    ],
  },
  'ahmedabad/gota': {
    about: [
      'Gota is a growing locality in the north-west of Ahmedabad, close to the SG Highway and the Sabarmati river. It has many newer residential projects and is still developing.',
      'It appeals to families and buyers who want newer homes at a distance from the busiest parts of the city.',
    ],
    gettingAround: [
      'The SG Highway and the roads towards Chandlodia and the ring road connect Gota to the rest of Ahmedabad. Because it is on the edge of the city, check the travel time to your workplace before you commit.',
    ],
    faqs: [
      {
        question: 'Where is Gota in Ahmedabad?',
        answer:
          'Gota is in north-west Ahmedabad, close to the SG Highway and the Sabarmati river.',
      },
      {
        question: 'What kinds of homes are available in Gota?',
        answer:
          'Where listings are available, you can browse apartments, houses and plots. Use the filters on this page to narrow by type, BHK and budget.',
      },
      {
        question: 'What should I check before buying a plot?',
        answer:
          'Check the ownership documents and the approvals for the layout, and have a lawyer read them before you pay. This is general information, not legal advice.',
      },
    ],
  },
};
