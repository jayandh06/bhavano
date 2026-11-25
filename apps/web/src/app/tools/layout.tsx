import { notFound } from "next/navigation";
import { marketCopy } from "@/lib/marketCopy";

/** The calculators and tools is India content (rupees, RERA, stamp duty, land records, Indian law): the US build answers 404 for it and for everything under it,
 * and its links are hidden (see marketCopy().indiaContent). India renders it exactly as before. */
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  if (!marketCopy().indiaContent) notFound();
  return children;
}
