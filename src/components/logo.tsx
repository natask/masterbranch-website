import Link from "next/link";
import Image from "next/image";
import { SITE_NAME } from "@/lib/config";

export function Logo({ size = "sm" }: { size?: "sm" | "md" }) {
  const dims = size === "md" ? "h-11 w-11" : "h-9 w-9";
  const px = size === "md" ? 44 : 36;

  return (
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/icon.png"
        alt={SITE_NAME}
        width={px}
        height={px}
        className={`${dims} cursor-pointer object-contain drop-shadow-[0_0_18px_rgba(201,165,92,0.18)] transition-transform duration-200 hover:scale-110`}
      />
    </Link>
  );
}
