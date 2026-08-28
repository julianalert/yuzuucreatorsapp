import type { Metadata } from "next";

export const SITE_NAME = "Yuzuu";
export const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL || "https://yuzuu.co"
).replace(/\/$/, "");

/** Creator share shown in marketing copy. Keep in sync with the pricing table. */
export const CREATOR_KEEP_PCT = 75;

export const SITE_TITLE = "Yuzuu — Earn regular income from your audience";
export const SITE_DESCRIPTION = `Yuzuu studies your audience, proposes product ideas, and builds the whole thing: quiz, sales page, personalized output. It costs you nothing and you keep ${CREATOR_KEEP_PCT}% of every sale.`;

export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return SITE_ORIGIN;
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export const noIndex: Metadata = {
  robots: { index: false, follow: false },
};

export function canonical(path: string): Pick<Metadata, "alternates" | "openGraph"> {
  const url = absoluteUrl(path);
  return {
    alternates: { canonical: url },
    openGraph: { url },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    email: "hello@yuzuu.co",
    description: SITE_DESCRIPTION,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_ORIGIN,
  };
}
