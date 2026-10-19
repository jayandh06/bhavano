/** First city overview drafts, written from general knowledge and NOT yet reviewed. Loaded into the
 * database as drafts by seed-area-overview-drafts.ts; from there they are edited, reviewed and
 * published in the admin app (City overviews). Keyed by city slug. Do not treat anything in here as
 * verified, and keep them general: no prices, no statistics, no claims that change quickly. */
import type { AreaOverviewContent } from '@bhavano/types/areaOverview';

const genuine = (city: string) => ({
  question: `How do I check a ${city} listing is genuine?`,
  answer:
    'See the property in person, meet the person who will sign the agreement, and get the terms in writing before you pay. Bhavano checks listings before they go live but does not inspect properties.',
});

export const CITY_OVERVIEW_DRAFTS: Record<string, AreaOverviewContent> = {
  bengaluru: {
    about: [
      "Bengaluru is the capital of Karnataka, in the south of India, and one of the country's main centres for technology work and start-ups. The city is spread out, with several business districts rather than one centre.",
      'People often choose a neighbourhood by its distance to work: the east and south-east around the Outer Ring Road are close to many technology parks, while areas such as Indiranagar and Jayanagar are established neighbourhoods closer to the middle of the city.',
    ],
    gettingAround: [
      'The city has a metro network, a large bus service and many auto-rickshaws and cabs. Traffic is heavy at peak hours, so check the commute to your workplace at the time you would actually travel before you choose an area.',
    ],
    faqs: [
      {
        question: 'Which areas in Bengaluru do people look at first?',
        answer:
          'Areas such as HSR Layout, Whitefield, Indiranagar, Jayanagar and Bellandur are widely searched. The best one for you depends mostly on where you work and how long a commute you accept.',
      },
      {
        question: 'What kinds of property can I find in Bengaluru on Bhavano?',
        answer:
          'Where listings are available, you can browse apartments, houses, villas, plots, PG rooms, coworking desks and commercial space. Use the filters on this page to narrow by area, type, BHK and budget.',
      },
      genuine('Bengaluru'),
    ],
  },
  'delhi-ncr': {
    about: [
      'Delhi NCR is the National Capital Region: Delhi together with nearby cities such as Gurugram, Noida, Ghaziabad and Faridabad. It spreads across several states, and each part has its own character, rules and travel times.',
      'People searching here usually start with the city that is closest to their workplace, because commuting between parts of the region can take a long time. Housing ranges from older colonies in Delhi to newer gated communities on its edges.',
    ],
    gettingAround: [
      'The Delhi Metro and its connected lines reach many parts of the region, and there are buses, cabs and auto-rickshaws as well. Check the nearest station and the usual travel time to your workplace for any area you shortlist.',
    ],
    faqs: [
      {
        question: 'What is included in Delhi NCR?',
        answer:
          'Delhi NCR covers Delhi and surrounding cities such as Gurugram, Noida, Ghaziabad and Faridabad. Look at the exact location in a listing, since two places with similar names can be in different cities.',
      },
      {
        question: 'How should I choose between the cities in the region?',
        answer:
          'Start from where you work and how long a daily commute you accept. Then compare the neighbourhoods near good transport links within that city.',
      },
      genuine('Delhi NCR'),
    ],
  },
  mumbai: {
    about: [
      "Mumbai is the capital of Maharashtra and India's main financial centre. The city is long and narrow, and the wider Mumbai region includes places such as Thane and Navi Mumbai.",
      'Space is limited, so homes are often smaller than in other cities, and where you live is mostly decided by how close you are to a railway station and to work. The western and eastern suburbs each have their own travel patterns.',
    ],
    gettingAround: [
      "The suburban railway is the main way most people travel, along with the metro on some routes, buses, taxis and auto-rickshaws. Check the distance from a listing to the nearest station and which line it is on.",
    ],
    faqs: [
      {
        question: 'How do I choose a neighbourhood in Mumbai?',
        answer:
          'Most people start with the railway line and the station nearest their workplace, then look at areas along that line. The exact walking distance to the station makes a big difference to daily life.',
      },
      {
        question: 'What kinds of property can I find in Mumbai on Bhavano?',
        answer:
          'Where listings are available, you can browse apartments, houses, PG rooms and commercial space. Use the filters on this page to narrow by area, type, BHK and budget.',
      },
      genuine('Mumbai'),
    ],
  },
  hyderabad: {
    about: [
      'Hyderabad is the capital of Telangana. It has grown quickly around its technology and business districts in the west, such as HITEC City, Gachibowli and the Financial District, alongside older parts of the city.',
      'Newer apartment and villa communities are common towards the western and northern edges, while the older city has a different mix of housing. People often choose an area by its distance to the office parks.',
    ],
    gettingAround: [
      'The city has a metro on some corridors, a large bus network, and the Outer Ring Road that links many outer areas. Traffic near the technology districts is heavy at peak hours, so test the route at the time you would travel.',
    ],
    faqs: [
      {
        question: 'Which areas in Hyderabad do people look at first?',
        answer:
          'Areas such as Gachibowli, HITEC City, Kukatpally and Bachupally are widely searched, especially by people who work in the western technology districts.',
      },
      {
        question: 'What kinds of property can I find in Hyderabad on Bhavano?',
        answer:
          'Where listings are available, you can browse apartments, houses, villas, plots and PG rooms. Use the filters on this page to narrow by area, type, BHK and budget.',
      },
      genuine('Hyderabad'),
    ],
  },
  pune: {
    about: [
      'Pune is a large city in Maharashtra, known for its colleges, universities and technology offices. It has several centres of activity, including areas around Hinjewadi, Kharadi, Baner and Aundh.',
      'It attracts students and working professionals, so there is a wide range of homes, from shared flats and PG rooms to family apartments. Many people choose an area by its distance to their college or office.',
    ],
    gettingAround: [
      "Buses, auto-rickshaws and cabs are widely used, and the city's metro covers some routes. Traffic near the major junctions is heavy at peak hours, so check the commute before you decide.",
    ],
    faqs: [
      {
        question: 'Which areas in Pune do people look at first?',
        answer:
          'Areas such as Aundh, Wakad, Kharadi, Baner and Wagholi are widely searched. The right one depends on where you study or work.',
      },
      {
        question: 'Is Pune a good city for students and young professionals?',
        answer:
          'It has many colleges and technology employers, and a large supply of PG rooms and shared flats. Look at the exact address and the commute for any place you consider.',
      },
      genuine('Pune'),
    ],
  },
  chennai: {
    about: [
      'Chennai is the capital of Tamil Nadu, on the south-east coast. It has an established centre and a long technology and business corridor along the Old Mahabalipuram Road in the south.',
      'Areas such as Anna Nagar and Porur are well-established residential neighbourhoods, while the south has many apartment buildings close to the offices on the corridor. People often choose by distance to work and by which side of the city they know.',
    ],
    gettingAround: [
      'The city has a suburban railway, a metro on some routes, a large bus network, and many auto-rickshaws and cabs. The climate is hot and humid for much of the year, so check how far a listing is from the nearest station or main road.',
    ],
    faqs: [
      {
        question: 'Which areas in Chennai do people look at first?',
        answer:
          'Areas such as Thoraipakkam, Porur, Anna Nagar and others along the Old Mahabalipuram Road are widely searched, particularly by people who work on the technology corridor.',
      },
      {
        question: 'What kinds of property can I find in Chennai on Bhavano?',
        answer:
          'Where listings are available, you can browse apartments, houses, plots and PG rooms. Use the filters on this page to narrow by area, type, BHK and budget.',
      },
      genuine('Chennai'),
    ],
  },
  kolkata: {
    about: [
      'Kolkata is the capital of West Bengal, in the east of India, and one of its oldest major cities. It has an older central core, planned areas such as Salt Lake, and the newer planned township of New Town on the north-eastern edge.',
      'Housing ranges from long-established houses and older buildings in the centre to newer apartment complexes in the planned areas. Many people choose by connection to the metro and by distance to work.',
    ],
    gettingAround: [
      "The Kolkata Metro, which is the oldest in India, runs through the city, alongside buses, trams on some routes, taxis and a suburban railway. Check the nearest metro station and the usual travel time for any area you consider.",
    ],
    faqs: [
      {
        question: 'Which areas in Kolkata do people look at first?',
        answer:
          'Areas such as New Town, Dum Dum, Salt Lake and the older central neighbourhoods are widely searched. The right one depends on where you work and how you travel.',
      },
      {
        question: 'What kinds of property can I find in Kolkata on Bhavano?',
        answer:
          'Where listings are available, you can browse apartments, houses, PG rooms and commercial space. Use the filters on this page to narrow by area, type, BHK and budget.',
      },
      genuine('Kolkata'),
    ],
  },
  ahmedabad: {
    about: [
      'Ahmedabad is the largest city in Gujarat, divided by the Sabarmati river into an older eastern side and a newer western side. The western side has most of the newer residential and business areas, including those along the SG Highway.',
      'It attracts families and working professionals, and newer apartment projects are common in the growing north-west and west of the city. Many people choose by distance to work and by the area they already know.',
    ],
    gettingAround: [
      'The city has a bus rapid transit service, regular buses, a metro on some routes, and many auto-rickshaws and cabs. Check how far a listing is from the main roads and from the stops you would use.',
    ],
    faqs: [
      {
        question: 'Which areas in Ahmedabad do people look at first?',
        answer:
          'Areas such as Gota, Thaltej and others along the SG Highway are widely searched, particularly for newer apartments.',
      },
      {
        question: 'What kinds of property can I find in Ahmedabad on Bhavano?',
        answer:
          'Where listings are available, you can browse apartments, houses, plots and PG rooms. Use the filters on this page to narrow by area, type, BHK and budget.',
      },
      genuine('Ahmedabad'),
    ],
  },
};
