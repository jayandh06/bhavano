import { Redirect } from "expo-router";

/** A path the app has no screen for — typically a bhavano.com link Android handed to the app
 * (the app claims every path on www.bhavano.com) for a page that exists only on the website.
 * Land on Home rather than Expo Router's "Unmatched Route" screen. */
export default function NotFoundScreen() {
  return <Redirect href="/" />;
}
