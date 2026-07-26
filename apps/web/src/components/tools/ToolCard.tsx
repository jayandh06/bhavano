import Link from "next/link";

export function ToolCard({ href, icon, title, description }: { href: string; icon: string; title: string; description: string }) {
  return (
    <Link href={href} className="border border-border rounded-2xl bg-surface p-5 flex flex-col gap-2 text-text no-underline">
      <span className="text-2xl">{icon}</span>
      <span className="font-lora text-base font-semibold">{title}</span>
      <span className="text-[13px] text-text-soft leading-[1.5]">{description}</span>
    </Link>
  );
}
