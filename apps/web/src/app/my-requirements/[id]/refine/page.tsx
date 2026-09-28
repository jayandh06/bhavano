import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { BffAuthError, fetchMyRequirement } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { Footer } from "@/components/home/Footer";
import { PageHeader } from "@/components/home/PageHeader";
import { RequireLoginPrompt } from "@/components/home/RequireLoginPrompt";
import { RequirementRefinePage } from "@/components/home/RequirementRefinePage";

export const metadata = {
  title: "Finish your requirement",
  // Personal, logged-in content — nothing here should ever be indexed.
  robots: { index: false, follow: false },
};

/** docs/plans/requirement-refinement-questions.md — the same questions the capture opens as a
 * dialog, reachable later from /my-requirements. */
export default async function RefineRequirementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, { city, cityAreas, allCities }] = await Promise.all([auth(), resolvePageCityContext(undefined)]);
  const redirectTo = `/my-requirements/${id}/refine`;

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <div className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 pb-20">
        <Link href="/my-requirements" className="text-[13px] text-muted mb-4 inline-block">
          ← Your requirements
        </Link>
        {!session?.accessToken ? (
          <RequireLoginPrompt message="Log in to finish your requirement." redirectTo={redirectTo} />
        ) : (
          <Refine accessToken={session.accessToken} id={id} redirectTo={redirectTo} />
        )}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

async function Refine({ accessToken, id, redirectTo }: { accessToken: string; id: string; redirectTo: string }) {
  let requirement;
  try {
    requirement = await fetchMyRequirement(accessToken, id);
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <RequireLoginPrompt message="Log in to finish your requirement." redirectTo={redirectTo} />;
    }
    if (error instanceof Error && /not found|\(404/i.test(error.message)) notFound();
    throw error;
  }

  if (!requirement.canRefine) {
    // Past the edit window: our team has already acted on it, owners were already told, or it is
    // no longer open — changing the criteria underneath any of those would mislead someone.
    return (
      <div className="w-full border border-border rounded-xl bg-surface p-6 text-[13.5px]">
        <div className="font-lora text-lg font-bold mb-1.5">{requirement.searchLabel}</div>
        <p className="m-0 mb-4 text-muted">
          This requirement can&apos;t be changed any more — it&apos;s already being worked on, or it&apos;s no
          longer active. You can add a note to it, or start a new search.
        </p>
        <Link href="/my-requirements" className="text-green font-bold">
          Back to your requirements →
        </Link>
      </div>
    );
  }

  return <RequirementRefinePage requirement={requirement} />;
}
