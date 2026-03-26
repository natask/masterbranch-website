import { NextRequest, NextResponse } from "next/server";
import { SITE_DOMAIN } from "./lib/config";

const BRANCH_SUBDOMAIN = new RegExp(`^(?:www\\.)?(.+)\\.${SITE_DOMAIN.replace(".", "\\.")}$`);
const BRANCH_SUBDOMAIN_DEV = /^(?:www\.)?(.+)\.localhost/;

export function getBranchSlug(hostname: string): string | null {
  const match = hostname.match(BRANCH_SUBDOMAIN) ?? hostname.match(BRANCH_SUBDOMAIN_DEV);
  const slug = match?.[1];
  return slug && slug !== "www" ? slug : null;
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const slug = getBranchSlug(hostname);

  if (slug) {
    const url = request.nextUrl.clone();
    url.pathname = `/branch/${slug}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
