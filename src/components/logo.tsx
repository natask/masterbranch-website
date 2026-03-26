import Link from "next/link";

export function Logo({ size = "sm" }: { size?: "sm" | "md" }) {
  const dims = size === "md" ? "h-8 w-8" : "h-7 w-7";
  return (
    <Link href="/" className="flex items-center gap-3">
      <img src="/icon.png" alt="The Master Branch" className={dims} />
    </Link>
  );
}
