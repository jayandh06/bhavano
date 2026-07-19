import Link from "next/link";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";

export const metadata = {
  title: "Contact Us — Bhavano",
  description: "Get in touch with the Bhavano team for support, feedback, or partnership queries.",
};

const SUPPORT_EMAIL = "support@bhavano.com";

export default function ContactPage() {
  return (
    <StaticPageLayout title="Contact us" updated="17 July 2026">
      <PageSection heading="Get in touch">
        <p className="m-0">
          Have a question, need help with your account, or want to report a listing? Check our{" "}
          <Link href="/help" className="text-green font-bold">
            Help centre
          </Link>{" "}
          first — if that doesn&apos;t answer it, email us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-green font-bold">
            {SUPPORT_EMAIL}
          </a>{" "}
          and we&apos;ll get back to you as soon as we can.
        </p>
      </PageSection>

      <PageSection heading="What to include">
        <ul className="list-disc m-0 pl-5">
          <li>Account or login issues — the phone number or email your account uses.</li>
          <li>Reporting a listing — a link to the listing (or its title and city) and what&apos;s wrong with it.</li>
          <li>Privacy requests — see our{" "}
            <Link href="/privacy" className="text-green font-bold">
              Privacy Policy
            </Link>{" "}
            for what you can ask us to access or delete.
          </li>
          <li>Anything else — general feedback, partnership queries, or bug reports.</li>
        </ul>
      </PageSection>

      <PageSection heading="Legal">
        <p className="m-0">
          Read our{" "}
          <Link href="/terms" className="text-green font-bold">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-green font-bold">
            Privacy Policy
          </Link>
          .
        </p>
      </PageSection>
    </StaticPageLayout>
  );
}
