import Link from "next/link";
import { LEGAL_ENTITY, entityAddressLines } from "@bhavano/types/legalEntity";
import { auth } from "@/auth";
import { ContactForm } from "@/components/home/ContactForm";
import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";

export const metadata = {
  title: "Contact Us — Bhavano",
  description: `Get in touch with ${LEGAL_ENTITY.legalName}, the operator of Bhavano, for support, feedback, or partnership queries.`,
};

const SUPPORT_EMAIL = LEGAL_ENTITY.supportEmail;

export default async function ContactPage() {
  const addressLines = entityAddressLines();
  // Prefill only — the form works logged out on purpose, since "I can't log in" is one of the
  // topics. Reading the session here keeps the page a Server Component (see .claude/CLAUDE.md).
  const session = await auth();

  return (
    <StaticPageLayout title="Contact us" updated="26 August 2026">
      <PageSection heading="Registered entity">
        <p className="m-0">
          Bhavano is operated by <span className="text-text font-bold">{LEGAL_ENTITY.legalName}</span>
          {LEGAL_ENTITY.llpin && <> (LLPIN: {LEGAL_ENTITY.llpin})</>}.
        </p>
        {addressLines.length > 0 && (
          <address className="not-italic m-0 mt-2">
            <span className="text-muted">Registered office: </span>
            {addressLines.join(", ")}
          </address>
        )}
        {LEGAL_ENTITY.supportPhone && (
          <p className="m-0 mt-2">
            <span className="text-muted">Phone: </span>
            <a href={`tel:${LEGAL_ENTITY.supportPhone.replace(/\s/g, "")}`} className="text-green font-bold">
              {LEGAL_ENTITY.supportPhone}
            </a>
          </p>
        )}
      </PageSection>

      <PageSection heading="Get in touch">
        <p className="m-0 mb-4">
          Have a question, need help with your account, or want to report a listing? Check our{" "}
          <Link href="/help" className="text-green font-bold">
            Help centre
          </Link>{" "}
          first — if that doesn&apos;t answer it, send us the details below and we&apos;ll get back to
          you as soon as we can. Prefer email? Write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-green font-bold">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <ContactForm
          defaultName={session?.user?.name ?? undefined}
          defaultEmail={session?.user?.email ?? undefined}
        />
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
