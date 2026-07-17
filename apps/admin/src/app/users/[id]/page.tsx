import Link from "next/link";
import { notFound } from "next/navigation";
import type { ActivityEventDto } from "@bhavano/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { fetchUserActivity } from "@/lib/bff";

const EVENT_ICONS: Record<ActivityEventDto["type"], string> = {
  login: "🔑",
  listing_posted: "📝",
  listing_updated: "✏️",
  message_sent: "💬",
  favourite_added: "♡",
  listing_viewed: "👁",
};

export default async function UserActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { accessToken } = await requireAdmin();
  const { id } = await params;

  const activity = await fetchUserActivity(accessToken, id).catch(() => null);
  if (!activity) notFound();

  const { user, events } = activity;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <Link href="/logins" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, display: "inline-block" }}>
          ← Back to logins
        </Link>

        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20, background: "var(--surface)" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{user.name ?? "Unnamed user"}</h1>
          <div style={{ fontSize: 13.5, color: "var(--text-soft)", marginBottom: 4 }}>
            {[user.phone, user.email].filter(Boolean).join(" · ") || "No contact info"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {user.cityName ? `${user.cityName} · ` : ""}
            {user.role === "admin" ? "Admin" : "User"} · joined {new Date(user.createdAt).toLocaleDateString()}
          </div>
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Recent activity</h2>
        {events.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No recorded activity yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {events.map((event, i) => (
              <div
                key={`${event.type}-${event.refId}-${i}`}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  border: "1px solid var(--border)",
                  borderRadius: 9,
                  padding: "10px 14px",
                  background: "var(--surface)",
                }}
              >
                <span style={{ fontSize: 15 }}>{EVENT_ICONS[event.type]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5 }}>{event.summary}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
