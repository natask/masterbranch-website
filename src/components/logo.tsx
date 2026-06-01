import Link from "next/link";
import Image from "next/image";
import { SITE_NAME } from "@/lib/config";

export function Logo({ size = "sm" }: { size?: "sm" | "md" }) {
  const dims = size === "md" ? "h-14 w-14" : "h-[50px] w-[50px]";
  const px = size === "md" ? 56 : 50;

  return (
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/icon.svg"
        alt={SITE_NAME}
        width={px}
        height={px}
        className={`topbar-logo ${dims} cursor-pointer object-contain transition-transform duration-200 hover:scale-105`}
      />
    </Link>
  );
}
