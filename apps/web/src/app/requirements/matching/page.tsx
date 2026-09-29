import { permanentRedirect } from "next/navigation";

/** Superseded by the Requirements tab with "Only ones my listings fit" on. Kept as a redirect
 * because older match emails link here. See docs/plans/requirements-feed-for-owners-agents.md. */
export default function MatchingRequirementsPage() {
  permanentRedirect("/requirements?matches=1");
}
