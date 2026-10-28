import { requireAdmin } from "@/lib/requireAdmin";
import { fetchLoginSettings, fetchMoveToMobileAudience } from "@/lib/bff";
import { LoginSettingsForm } from "@/components/LoginSettingsForm";
import { MoveToMobilePanel } from "@/components/MoveToMobilePanel";
import { FullPageLink } from "@/components/FullPageLink";

export default async function LoginSettingsPage() {
  const { accessToken } = await requireAdmin();
  const [settings, audience] = await Promise.all([fetchLoginSettings(accessToken), fetchMoveToMobileAudience(accessToken)]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <FullPageLink href="/" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          &larr; Back to dashboard
        </FullPageLink>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Login methods</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 24px", maxWidth: 680 }}>
          Choose whether people can sign in with an email identity (Google or Apple). A mobile number with an OTP always works. Closing or narrowing email sign-in is a way to
          stop fake accounts made with throwaway email addresses from collecting owners&rsquo; contact details. See docs/plans/email-login-switch.md.
        </p>
        <LoginSettingsForm initial={settings} />
        <MoveToMobilePanel audience={audience} />
      </div>
    </div>
  );
}
