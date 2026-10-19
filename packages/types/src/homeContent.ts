/** Text shared by the website's homepage sections and the app's end-of-feed section, so the two
 * can never say different things about how Bhavano works. See docs/plans/homepage-seo-aeo-structure.md.
 *
 * Only claims that are already true on the site: browsing is free and needs no login; boosting is
 * a paid option (posting itself is not called free, because platform fees vary by category);
 * listings are checked before they go live but properties are not inspected; brokerage is stated
 * by whoever posted. No counts or figures. */

export const HOME_STEPS: { title: string; text: string }[] = [
  { title: "Search", text: "Pick a city and a category, then browse listings. No login is needed to look." },
  { title: "Check", text: "Open a listing for photos, details and the location. Visit the place before you pay anything." },
  {
    title: "Connect",
    text: "Message the owner or agent on Bhavano. Log in with Google or your phone number only when you post, save or message.",
  },
];

export interface HomeFaq {
  question: string;
  answer: string;
}

/** `cityNames` are the cities to name in the coverage answer; empty falls back to "across India". */
export function homeFaqs(cityNames: string[]): HomeFaq[] {
  const names = cityNames.slice(0, 6);
  const coverage =
    names.length === 0
      ? "across India"
      : `including ${names.slice(0, -1).join(", ")}${names.length > 1 ? " and " : ""}${names[names.length - 1]}`;
  return [
    {
      question: "What is Bhavano?",
      answer:
        "Bhavano is an online marketplace in India where you can buy, sell, rent or lease homes, plots, PG rooms, coworking desks, storage and commercial space. Browsing is free and needs no login.",
    },
    {
      question: "Do I need to log in to search listings?",
      answer:
        "No. You can search and open listings without an account. You log in with Google or your phone number only when you want to post a listing, save a favourite or message an owner.",
    },
    {
      question: "How do I post a property on Bhavano?",
      answer:
        "Choose Post, pick a category, add the details, photos and location, then preview and publish. You will be asked to log in at the point you publish. Some optional services, such as boosting a listing, are paid.",
    },
    {
      question: "How do I know a listing is genuine?",
      answer:
        "Bhavano checks listings before they go live, but we do not inspect properties. Always see the place in person, meet the person who will sign the agreement, and get the terms in writing before you pay.",
    },
    {
      question: "Which cities does Bhavano cover?",
      answer: `Bhavano has listings in cities across India, ${coverage}. Use the city picker to browse a city.`,
    },
    {
      question: "Do I need a broker to use Bhavano?",
      answer:
        "No. Owners and agents post their own listings and you message them directly. Whether a particular listing involves a brokerage fee is stated by the person who posted it, so ask before you commit.",
    },
  ];
}
