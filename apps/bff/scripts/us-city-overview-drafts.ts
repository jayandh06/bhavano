/** US city overview drafts, written from general knowledge and NOT yet reviewed. Loaded into the US database as drafts by seed-area-overview-drafts.ts (MARKET=us);
 * nothing is public until an overview is reviewed and published. Keyed by slugify(city name). Keep them general and stable: no prices or statistics, no claims that
 * change quickly, and nothing about who lives somewhere, how safe it is or how good its schools are (Fair Housing). See docs/plans/us-cities-seed.md. */
import type { AreaOverviewContent } from '@bhavano/types/areaOverview';

const genuine = (city: string) => ({
  question: `How do I check a ${city} listing is genuine?`,
  answer:
    'Bhavano does not check listings before they appear and does not inspect properties. See the home in person or through someone you trust, confirm the person offering it can rent or sell it, and get the terms in writing before you pay.',
});

export const US_CITY_OVERVIEW_DRAFTS: Record<string, AreaOverviewContent> = {
  'new-york': {
    about: [
      'New York City is made up of five boroughs: Manhattan, Brooklyn, Queens, the Bronx and Staten Island. Each has many neighborhoods with their own housing stock, from walk-up apartment buildings and brownstones to high-rise towers.',
      'Homes for sale include condos and co-ops. A co-op sale usually needs the approval of the building’s board, so ask which type a home is and what the process involves before you make an offer.',
    ],
    gettingAround: [
      'The subway runs around the clock and reaches much of the city, alongside buses, ferries and commuter railroads to the suburbs. Check the nearest station and your usual travel time at the hour you would actually make the trip.',
    ],
    faqs: [
      {
        question: 'What should I confirm before renting an apartment in New York?',
        answer:
          'Ask for the full list of upfront costs, who pays any broker fee, the lease length, whether the apartment is rent stabilized, and which utilities are included. Get the answers in writing.',
      },
      genuine('New York'),
    ],
  },
  'los-angeles': {
    about: [
      'Los Angeles is a large, spread-out city in Southern California, with many distinct neighborhoods and several business districts rather than one center. Some nearby places, such as Santa Monica, Pasadena and Culver City, are separate cities with their own rules.',
      'Housing ranges from apartment buildings and condos to detached houses, in the flat basin, along the coast and in the hills.',
    ],
    gettingAround: [
      'Metro rail and bus lines serve parts of the region, but many trips are made by car on the freeways. Traffic varies a great deal by time of day, so try your commute before you choose a neighborhood, and ask about parking.',
    ],
    faqs: [
      {
        question: 'How should I choose a neighborhood in Los Angeles?',
        answer:
          'Start with where you travel most days and how long a trip you accept. Then compare homes near that route, checking parking, transit access and which city the address is in.',
      },
      genuine('Los Angeles'),
    ],
  },
  chicago: {
    about: [
      'Chicago sits on the southwest shore of Lake Michigan and is organized into many named neighborhoods. The central business district is known as the Loop.',
      'Common home types include courtyard apartment buildings, two- and three-flats, high-rise condos near the lakefront and detached bungalows farther from the center.',
    ],
    gettingAround: [
      'The CTA runs the elevated and subway trains known as the L, plus an extensive bus network, and Metra commuter trains link the suburbs with downtown. Winters are cold and snowy, so check the walk to your stop and how parking works.',
    ],
    faqs: [
      {
        question: 'What should I ask about heating in a Chicago rental?',
        answer:
          'Ask whether heat is included in the rent, what kind of system the home has, and who pays for gas and electricity. Ask for typical winter bills if you will pay them.',
      },
      genuine('Chicago'),
    ],
  },
  houston: {
    about: [
      'Houston is the largest city in Texas and spreads across a wide, flat area near the Gulf Coast. Suburbs such as Katy, Sugar Land, Pearland and The Woodlands are part of the wider region, with their own local rules.',
      'Houston does not have a conventional zoning ordinance, so uses can sit close together. Deed restrictions and homeowners’ associations may set rules for a particular property.',
    ],
    gettingAround: [
      'Most trips are made by car on a network of freeways and toll roads. METRO runs buses and light rail, mainly in the central parts of the city. Check your commute at peak hours before choosing a location.',
    ],
    faqs: [
      {
        question: 'Why should I check flood risk for a home in Houston?',
        answer:
          'Parts of the region have flooded in heavy rain and storms. Look up the flood zone, ask the owner or seller about past flooding, and find out whether flood insurance is required or advisable.',
      },
      genuine('Houston'),
    ],
  },
  dallas: {
    about: [
      'Dallas is a major city in north Texas and, with Fort Worth, anchors a large metropolitan region. Places such as Plano, Frisco, Irving and Richardson are separate cities with their own taxes and rules.',
      'Housing includes apartment complexes, townhouses, condos near the center and detached houses across the city and its suburbs.',
    ],
    gettingAround: [
      'Driving is the usual way to get around, on several freeways and toll roads. DART runs light rail and buses, and the Trinity Railway Express connects Dallas with Fort Worth. Check which of these serves your route.',
    ],
    faqs: [
      {
        question: 'Is a Plano or Frisco address the same as a Dallas address?',
        answer:
          'No. They are separate cities in the same region. Check the exact address in a listing, because local taxes, services and rules depend on the city and county it is in.',
      },
      genuine('Dallas'),
    ],
  },
  austin: {
    about: [
      'Austin is the capital of Texas and home to the main campus of the University of Texas. The Colorado River runs through the city, and nearby Round Rock and Cedar Park are separate cities.',
      'Homes range from apartments and condos downtown and along main corridors to bungalows in older central neighborhoods and newer houses toward the edges.',
    ],
    gettingAround: [
      'Many residents drive, with I-35 and MoPac as major north-south routes. CapMetro runs buses and a commuter rail line. Test your commute at peak hours before you decide.',
    ],
    faqs: [
      {
        question: 'When should I start looking for a rental in Austin?',
        answer:
          'Near the university, many leases follow the academic year, so homes there can be taken well ahead of August. Elsewhere, start early enough to see homes in person and compare lease terms.',
      },
      genuine('Austin'),
    ],
  },
  phoenix: {
    about: [
      'Phoenix is the capital of Arizona, in the Sonoran Desert. It is part of a region often called the Valley of the Sun, which includes separate cities such as Scottsdale, Tempe, Mesa, Chandler and Gilbert.',
      'Single-story houses, townhouses and apartment complexes are common, many with shared pools or homeowners’ associations.',
    ],
    gettingAround: [
      'Streets largely follow a grid, and most trips are by car on city streets and freeways. Valley Metro runs buses and light rail serving parts of Phoenix, Tempe and Mesa.',
    ],
    faqs: [
      {
        question: 'What should I check about summer cooling in Phoenix?',
        answer:
          'Summers are extremely hot. Ask about the age and condition of the air conditioning, who repairs it and how quickly, and what summer electricity bills have been.',
      },
      genuine('Phoenix'),
    ],
  },
  atlanta: {
    about: [
      'Atlanta is the capital of Georgia and the center of a large metropolitan region. People often describe locations as inside or outside the Perimeter, the I-285 highway that circles the city.',
      'Housing includes high-rise condos in Midtown and Buckhead, houses in tree-lined older neighborhoods, townhouses and suburban homes in separate cities such as Decatur, Marietta, Sandy Springs and Alpharetta.',
    ],
    gettingAround: [
      'MARTA runs rail lines and buses, with trains to the airport. Many trips are made by car and highway traffic can be heavy, so check your route at the time you would travel.',
    ],
    faqs: [
      {
        question: 'What does inside the Perimeter mean in Atlanta?',
        answer:
          'It means inside the I-285 loop around the city. It is a rough guide to how central a home is; the exact city and county of the address decide local taxes and services.',
      },
      genuine('Atlanta'),
    ],
  },
  miami: {
    about: [
      'Miami is on the southeast coast of Florida, along Biscayne Bay. Miami Beach, Coral Gables, Doral, Aventura and Fort Lauderdale are separate cities nearby.',
      'Condos are common near the water and downtown, with houses and townhouses farther inland. Condo buildings have associations with their own fees and rules.',
    ],
    gettingAround: [
      'Metrorail and buses serve parts of the county, and the free Metromover loops through downtown and Brickell. Brightline trains run north along the coast. Many trips are by car.',
    ],
    faqs: [
      {
        question: 'What should I ask about storms and insurance in Miami?',
        answer:
          'Ask about the flood zone, hurricane shutters or impact windows, past flooding, and what insurance the owner carries and what you would need. For a condo, ask about the association’s fees and any planned assessments.',
      },
      genuine('Miami'),
    ],
  },
  washington: {
    about: [
      'Washington, D.C. is the capital of the United States and is divided into four quadrants: Northwest, Northeast, Southwest and Southeast. The quadrant is part of every address.',
      'Row houses, apartment buildings and condos are common in the city. Arlington and Alexandria in Virginia, and Bethesda and Silver Spring in Maryland, are close by and follow their own state and local rules.',
    ],
    gettingAround: [
      'Metrorail and buses connect the city with Maryland and Virginia suburbs, and commuter trains run from farther out. Check the nearest station and your travel time at rush hour.',
    ],
    faqs: [
      {
        question: 'Do rental rules differ between D.C., Maryland and Virginia?',
        answer:
          'Yes. Each has its own landlord and tenant law, and counties or cities may add rules. Check the jurisdiction of the address before you sign a lease.',
      },
      genuine('Washington'),
    ],
  },
  boston: {
    about: [
      'Boston is the capital of Massachusetts, a compact harbor city with many distinct neighborhoods. Cambridge and Somerville, across the Charles River, are separate cities.',
      'Brick row houses, triple-deckers, condos and apartment buildings are all common, and many buildings are old, so ask about heating, insulation and laundry.',
    ],
    gettingAround: [
      'The MBTA, known as the T, runs subway and trolley lines, buses, ferries and commuter rail. Central neighborhoods are walkable, and street parking often needs a resident permit.',
    ],
    faqs: [
      {
        question: 'Why do so many Boston leases start on September 1?',
        answer:
          'Many follow the university calendar, so a large number of homes change hands around that date. Start looking early if you need a September move, and check the start date in each listing.',
      },
      genuine('Boston'),
    ],
  },
  'san-francisco': {
    about: [
      'San Francisco covers the tip of a peninsula between the Pacific Ocean and San Francisco Bay. Its hills and neighborhoods have noticeably different weather, with fog common toward the ocean.',
      'Flats in older multi-unit buildings, condos and detached houses are typical. Oakland and Berkeley, across the bay, are separate cities with their own rules.',
    ],
    gettingAround: [
      'Muni runs buses, light rail, streetcars and the cable cars, and BART trains connect the city with the East Bay and the airport. Parking can be hard to find, so ask whether a space comes with the home.',
    ],
    faqs: [
      {
        question: 'Does rent control apply to a San Francisco rental?',
        answer:
          'Many homes are covered by the city’s rent ordinance, but not all of them, and different rules limit increases and evictions. Ask the owner and check with the San Francisco Rent Board for the specific address.',
      },
      genuine('San Francisco'),
    ],
  },
  seattle: {
    about: [
      'Seattle lies between Puget Sound and Lake Washington, with hills, waterways and many named neighborhoods. Bellevue and Redmond, east of the lake, are separate cities.',
      'Apartments and condos cluster around the center and busy corridors, while houses and townhouses are common in residential neighborhoods.',
    ],
    gettingAround: [
      'King County Metro buses and Link light rail serve the region, and ferries cross Puget Sound. Bridges can shape commute times, so check a route that crosses water at peak hours.',
    ],
    faqs: [
      {
        question: 'What should I check in a Seattle home before the rainy season?',
        answer:
          'Look for signs of damp or leaks, ask how the home is heated and ventilated, and check drainage around ground-floor and basement rooms.',
      },
      genuine('Seattle'),
    ],
  },
  denver: {
    about: [
      'Denver is the capital of Colorado, on the plains just east of the Rocky Mountains, and is often called the Mile High City. Aurora, Lakewood and Englewood are neighboring cities.',
      'Housing includes downtown apartments and condos, brick bungalows in older neighborhoods, townhouses and newer suburban homes.',
    ],
    gettingAround: [
      'RTD runs buses, light rail and commuter rail, including a train between Union Station and the airport. Many trips are by car, and snow can slow travel in winter.',
    ],
    faqs: [
      {
        question: 'Who clears snow at a Denver rental?',
        answer:
          'It depends on the property and the lease. Ask whether the landlord, the association or the tenant clears sidewalks, driveways and parking, and get it written into the lease.',
      },
      genuine('Denver'),
    ],
  },
  charlotte: {
    about: [
      'Charlotte is the largest city in North Carolina and a major banking center. Its central business district is known as Uptown, and Matthews and Huntersville are separate towns nearby.',
      'Homes range from apartments and condos in Uptown and South End to houses in older close-in neighborhoods and townhouses and houses toward the county’s edges.',
    ],
    gettingAround: [
      'Most trips are by car, with I-77, I-85 and the I-485 loop as main routes. The Charlotte Area Transit System runs buses, the LYNX Blue Line light rail and a streetcar line.',
    ],
    faqs: [
      {
        question: 'Where is Uptown Charlotte?',
        answer:
          'Uptown is the name used for the city’s central business district. A listing described as near Uptown can still be some distance away, so check the address and your travel time.',
      },
      genuine('Charlotte'),
    ],
  },
};
