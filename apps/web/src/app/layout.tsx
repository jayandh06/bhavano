import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { LEGAL_ENTITY, entityAddressLines } from "@bhavano/types/legalEntity";
import { AuthGateProvider } from "@/components/home/AuthGateProvider";
import { ProfileCompletionBanner } from "@/components/home/ProfileCompletionBanner";
import { SignupConversionTracker } from "@/components/home/SignupConversionTracker";
import { JsonLd } from "@/components/JsonLd";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
// Google Ads conversion ID (AW-XXXXXXXXXX), installed as a direct gtag.js tag rather than through
// the GTM container above — leave blank to skip loading it entirely (the default locally, so dev
// traffic never pollutes real Ads reporting). gtag.js handles gclid link-decoration itself, so no
// separate Conversion Linker tag is needed on this path. Like every NEXT_PUBLIC_*, this is inlined
// at `next build`, so prod needs it as a docker build arg — not just a runtime environment entry.
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const GOOGLE_MAPS_JS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY;
const SITE_NAME = "Bhavano";
const ENTITY_ADDRESS_LINES = entityAddressLines();
const SITE_TITLE = "Bhavano — Buy, Rent, Plots, Coworking, PG & More";
const SITE_DESCRIPTION =
  "India's home for Buy, Rent, Villas, Plots, Commercial Spaces, Coworking, PG and Furniture listings — browse without login, verified listings across India.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  robots: { index: true, follow: true },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_IN",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${lora.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <JsonLd
          data={{
            "@type": "Organization",
            name: SITE_NAME,
            // Machine-readable brand → registered-entity link, for the automated scrapes that
            // DLT/telco and payment-aggregator verification run against the homepage.
            legalName: LEGAL_ENTITY.legalName,
            url: SITE_URL,
            description: SITE_DESCRIPTION,
            ...(ENTITY_ADDRESS_LINES.length > 0 && {
              address: { "@type": "PostalAddress", streetAddress: ENTITY_ADDRESS_LINES.join(", ") },
            }),
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "customer support",
              email: LEGAL_ENTITY.supportEmail,
              ...(LEGAL_ENTITY.supportPhone && { telephone: LEGAL_ENTITY.supportPhone }),
            },
          }}
        />
        {GOOGLE_MAPS_JS_KEY && (
          <Script id="google-maps-api-key" strategy="beforeInteractive">
            {`window.__BHAVANO_GOOGLE_MAPS_JS_KEY__=${JSON.stringify(GOOGLE_MAPS_JS_KEY)};`}
          </Script>
        )}
        {GTM_ID && (
          <Script id="gtm-loader" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        )}
        {GOOGLE_ADS_ID && (
          <>
            <Script
              id="google-tag-loader"
              src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-tag-config" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_ADS_ID}');`}
            </Script>
          </>
        )}
      </head>
      <body suppressHydrationWarning>
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <AuthGateProvider>
            <SignupConversionTracker />
            <ProfileCompletionBanner />
            {children}
          </AuthGateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
