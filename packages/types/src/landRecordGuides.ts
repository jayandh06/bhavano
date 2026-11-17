import type { BlogPost } from "./blogPosts";

/** Blog posts on reading government land records before buying land: Karnataka's RTC (Bhoomi), Madhya Pradesh's khasra and khatauni
 * (MP Bhulekh), and bhu naksha village maps in general. Appended to POSTS in blogPosts.ts. Published 2026-11-17. See
 * docs/plans/blog-backlink-content.md (land record guides) and docs/plans/semrush-snapshot-2026-11.md for why these were written.
 *
 * Same rules as the rest of the blog: the answer comes first, headings are the questions, no prices, fees, rates or percentages, no
 * invented author. Government portals rename menus and move pages, so the posts name only the portal's home address and describe the
 * steps in general terms; they never quote a fee or a deep link. They were written from general knowledge and public descriptions of the
 * portals and must be read by someone who has used each portal, and by a lawyer, before they are promoted. */

export const LAND_RECORD_GUIDES: BlogPost[] = [
  {
    slug: "karnataka-bhoomi-rtc-pahani-explained",
    title: "Karnataka RTC (Pahani) on Bhoomi: how to read it before you buy land",
    description:
      "What the RTC or Pahani shows for a Karnataka survey number, how to view it on the Bhoomi portal, and what it does and does not prove about ownership.",
    published: "2026-11-17",
    format: "Guide",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. Land rules differ by state and the Bhoomi portal changes its menus from time to time, so confirm the steps on the official site. Have a property lawyer check the documents before you pay a significant amount.",
      },
      { type: "h2", text: "What is an RTC or Pahani in Karnataka?" },
      {
        type: "p",
        text: "RTC stands for Record of Rights, Tenancy and Crops. It is the government's record for one survey number of land in Karnataka, and it is also called the Pahani. It shows who is recorded as holding the land, how much land the survey number covers, whether anyone is recorded as a tenant, and what is grown on it. It is mainly a record for agricultural land and village land, so it is the first paper to ask for when you are looking at a plot or farmland outside a city's municipal limits.",
      },
      { type: "h2", text: "How do I view an RTC online?" },
      {
        type: "ol",
        items: [
          "Open the state's Bhoomi land records portal. Its address is landrecords.karnataka.gov.in; type it in yourself instead of following a link from an ad or a message.",
          "Choose the option for viewing the RTC and the mutation register. The exact wording on the menu changes, so look for RTC.",
          "Select the district, taluk, hobli and village, then enter the survey number and the hissa number if the land has one.",
          "Pick the year you want. The current year shows the present record, and earlier years show how it has changed.",
          "Read the result, and save or print it. Viewing is usually available to anyone, but check the portal for the current rules and any fee for a certified copy.",
        ],
      },
      {
        type: "p",
        text: "Keep the survey number, the hissa number and the village name from the seller's sale deed or allotment papers in front of you. A wrong digit shows you a different piece of land, and the page will not warn you.",
      },
      { type: "h2", text: "What should I look for in the RTC?" },
      {
        type: "ul",
        items: [
          "Is the seller's name the one recorded as holder, and is it spelt the same as on their ID and sale deed? If several people are listed, all of them must agree to the sale.",
          "Does the extent in the RTC match the extent in the seller's documents?",
          "Is anyone recorded as a tenant or cultivator? A person recorded as a tenant may have rights that the seller cannot ignore.",
          "Are there entries for a loan, a court order or another burden on the land? Where the record carries such notes, ask the seller to explain each one in writing.",
          "Has the land been converted from agricultural use? If you plan to build a home, ask for the conversion order and check the layout approval too. See [buying a plot checklist](/blog/buying-a-plot-checklist).",
          "Do the earlier years show a sensible history, or does the holder's name change often?",
        ],
      },
      { type: "h2", text: "Does the RTC prove that the seller owns the land?" },
      {
        type: "p",
        text: "No. The RTC is a revenue record. It shows who is recorded as holder for the purposes of the land revenue system, and it helps you check what the seller tells you. It does not by itself prove title. Title comes from the chain of registered documents, which is why you also need the sale deed, the encumbrance certificate and a lawyer's opinion. Read [how to check if a property has a clear title](/blog/how-to-check-property-title-is-clear) for the full list.",
      },
      { type: "h2", text: "What is the difference between the RTC and the khata?" },
      {
        type: "p",
        text: "The RTC is the record for rural and agricultural land, kept by the revenue department. The khata is the record kept by a city or town body for property inside its limits, and it is what you check for a flat or a house in a city. For a plot inside Bengaluru, see [A khata and B khata](/blog/a-khata-b-khata-bengaluru).",
      },
      { type: "h2", text: "What should I do after buying?" },
      {
        type: "p",
        text: "Registering the sale deed does not by itself change the revenue record. Apply for mutation so that your name appears as the holder, then view the RTC again to confirm the change has been made. See [property mutation after buying](/blog/property-mutation-after-buying-india).",
      },
      {
        type: "p",
        text: "To compare land and plots in your city, see the [plot listings](/plot), and use the [area unit converter](/tools/area-unit-converter) to compare sizes given in different units. Bhavano checks listings before they go live but does not inspect land or verify its papers; read [what we don't verify](/trust).",
      },
    ],
  },
  {
    slug: "mp-bhulekh-khasra-khatauni-explained",
    title: "MP Bhulekh: how to check a khasra and khatauni in Madhya Pradesh",
    description:
      "What khasra, khatauni (B-1) and nakal mean in Madhya Pradesh, how to look up a plot on the MP Bhulekh portal, and when you need a certified copy.",
    published: "2026-11-17",
    format: "Guide",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. Land rules differ by state and the MP Bhulekh portal changes its menus from time to time, so confirm the steps on the official site. Have a property lawyer check the documents before you pay a significant amount.",
      },
      { type: "h2", text: "What is MP Bhulekh?" },
      {
        type: "p",
        text: "MP Bhulekh is the Madhya Pradesh government's online portal for land records. Its address is mpbhulekh.gov.in. It lets you look up the records the revenue department keeps for a plot of land, such as the khasra and the khatauni, and see the village map. Type the address in yourself instead of following a link from an ad or a message.",
      },
      { type: "h2", text: "What do khasra, khatauni and nakal mean?" },
      {
        type: "ul",
        items: [
          "Khasra is the plot-level record. Each plot in a village has a khasra number, and the record shows its area, the kind of land and who is recorded as holding it.",
          "Khatauni, also called B-1, is the record of rights. It lists the holders and the plots they hold, so it shows everything recorded under one holder's name in a village.",
          "Nakal is a copy of a record. An online copy is a reference. A certified nakal from the tehsil office is the one you use for legal and official work.",
        ],
      },
      { type: "h2", text: "How do I look up a plot on MP Bhulekh?" },
      {
        type: "ol",
        items: [
          "Open the portal and choose the option for the khasra or khatauni record. The wording on the menu changes, so look for khasra.",
          "Select the district, tehsil and village.",
          "Search by khasra number, by khatauni number or by the holder's name, and complete the captcha.",
          "Open the result, and save or print it. For a current record, pick the latest year offered. Earlier years show how the record changed.",
          "If you want a certified copy, find out from the tehsil office or the state's online citizen services how to apply and what the current fee is. Do not rely on a figure quoted on a blog.",
        ],
      },
      {
        type: "p",
        text: "Take the district, tehsil, village and khasra number from the seller's own papers. A wrong digit shows a different plot, and the page will not warn you.",
      },
      { type: "h2", text: "What should I check in the record?" },
      {
        type: "ul",
        items: [
          "Is the seller's name recorded as the holder, spelt the same as on their ID and sale deed? If several holders are listed, all of them must agree to the sale.",
          "Does the area in the record match the area in the seller's documents and the area you see on the map?",
          "Is the land recorded as agricultural? If you plan to build, ask about the diversion or conversion order, and check the local approval for the layout. See [buying a plot checklist](/blog/buying-a-plot-checklist).",
          "Are there notes about a loan, a dispute or another burden? Ask the seller to explain each in writing.",
          "Does the history across the years look sensible?",
        ],
      },
      { type: "h2", text: "Does the khasra prove the seller owns the land?" },
      {
        type: "p",
        text: "No. These are revenue records. They help you check what the seller tells you and who is recorded as holding the land, but title comes from the chain of registered documents. Ask for the sale deed, get an encumbrance certificate and have a lawyer give an opinion. Read [how to check if a property has a clear title](/blog/how-to-check-property-title-is-clear).",
      },
      { type: "h2", text: "What should I do after buying?" },
      {
        type: "p",
        text: "After the sale deed is registered, apply for mutation so that your name is entered as the holder, and look up the record again to confirm. See [property mutation after buying](/blog/property-mutation-after-buying-india). For registration and its costs, read [stamp duty and registration charges](/blog/stamp-duty-and-registration-charges-explained).",
      },
      {
        type: "p",
        text: "Compare land and plots on Bhavano in the [plot listings](/plot), and use the [area unit converter](/tools/area-unit-converter) for sizes given in different units. Bhavano checks listings before they go live but does not inspect land or verify its papers; read [what we don't verify](/trust).",
      },
    ],
  },
  {
    slug: "bhu-naksha-land-map-explained",
    title: "Bhu Naksha: how to view a village land map online and what it tells you",
    description:
      "What a bhu naksha is, how to find your state's official map portal, how to read a plot on it, and why a downloaded map is not a legal document.",
    published: "2026-11-17",
    format: "Guide",
    readingMinutes: 6,
    body: [
      {
        type: "note",
        text: "General information, not legal advice. Land records and maps are run by each state, and portals change their addresses and menus from time to time. Confirm the steps on your state's official site and have a property lawyer check the documents before you pay a significant amount.",
      },
      { type: "h2", text: "What is a bhu naksha?" },
      {
        type: "p",
        text: "A bhu naksha, also written bhunaksha, is the government's map of the land in a village. It draws each plot with its boundary and its survey or khasra number, so you can see the shape of the plot, which plots are next to it and where the roads, streams and common land lie. It is a different record from the record of rights, which says who holds the land. Use the two together.",
      },
      { type: "h2", text: "Is there one national site for bhu naksha?" },
      {
        type: "p",
        text: "No. Maps are prepared and kept by each state, so each has its own portal, and some states call the map something else, such as the field measurement book or village map. Search for your state's name with bhu naksha or land map, and open only a site whose address ends in gov.in or nic.in. Many look-alike sites charge for what the government gives for free, so do not pay or enter personal details on a site you cannot confirm is official.",
      },
      { type: "h2", text: "How do I view a plot on the map?" },
      {
        type: "ol",
        items: [
          "Open your state's official land map portal, typing the address in yourself instead of following a link from an ad or a message.",
          "Choose the district, tehsil or taluka, and village. Some portals ask for a hobli, circle or other local unit as well.",
          "Enter the survey or khasra number from the seller's papers, or click on the map and zoom in.",
          "Select the plot. Most portals show its number and boundary, and some show the area and the holder's name in a side panel.",
          "Save or print the map. Viewing is generally free; if a site asks for payment, check it is the official portal.",
        ],
      },
      { type: "h2", text: "What should I check on the map?" },
      {
        type: "ul",
        items: [
          "Does the plot number match the number in the seller's sale deed and the record of rights?",
          "Does the shape and area on the map roughly match the documents and what you see on the ground?",
          "Which plots, roads or water bodies lie next to it? Does the plot have a recorded access road?",
          "If the plot is a part of a larger survey number, is the part being sold clearly identified, and has it been measured?",
          "Walk the boundary with the seller and the neighbours. Maps can lag behind sales, splits and encroachment.",
        ],
      },
      { type: "h2", text: "Is a downloaded map a legal document?" },
      {
        type: "p",
        text: "No. A map you print from the portal is for information. If you need a map for a registration, a loan or a court matter, ask the revenue office how to get a certified copy. Treat the online map as a way to check what the seller tells you, not as proof of ownership or of exact boundaries. For a licensed surveyor's measurement, hire one before you buy.",
      },
      { type: "h2", text: "What else should I check before buying a plot?" },
      {
        type: "p",
        text: "Check the record of rights for your state, the sale deed chain and the encumbrance certificate, and confirm that the layout is approved. Read [how to check if a property has a clear title](/blog/how-to-check-property-title-is-clear) and [buying a plot checklist](/blog/buying-a-plot-checklist). For Karnataka, read [how to read the RTC on Bhoomi](/blog/karnataka-bhoomi-rtc-pahani-explained), and for Madhya Pradesh, [how to check a khasra and khatauni](/blog/mp-bhulekh-khasra-khatauni-explained).",
      },
      {
        type: "p",
        text: "Use the [area unit converter](/tools/area-unit-converter) to compare plot sizes given in different units, and browse [plot listings](/plot) on Bhavano. We check listings before they go live but do not inspect land or verify its papers; read [what we don't verify](/trust).",
      },
    ],
  },
];
