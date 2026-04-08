import Link from "next/link";
import Image from "next/image";
import { SITE_NAME } from "@/lib/config";

export function Logo({ size = "sm" }: { size?: "sm" | "md" }) {
  const dims = size === "md" ? "h-8 w-8" : "h-7 w-7";
  const px = size === "md" ? 32 : 28;

  return (
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/icon.png"
        alt={SITE_NAME}
        width={px}
        height={px}
        className={`${dims} cursor-pointer transition-transform duration-200 hover:scale-110`}
      />
    </Link>
  );
}
