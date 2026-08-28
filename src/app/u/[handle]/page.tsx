import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publishedProductByHandle } from "@/lib/public";
import { Wordmark } from "@/components/Wordmark";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl, canonical, noIndex } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const product = await publishedProductByHandle(handle);
  if (!product) return { title: "Yuzuu", ...noIndex };
  const title = `${product.title} — ${product.creatorName}`;
  const path = `/u/${product.handle}`;
  return {
    title,
    description: product.promise,
    ...canonical(path),
    openGraph: {
      ...canonical(path).openGraph,
      title,
      description: product.promise,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: product.promise,
    },
  };
}

export default async function SalesPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const product = await publishedProductByHandle(handle);
  if (!product) notFound();

  const price = (product.priceCents / 100).toFixed(0);
  const covers = product.sectionTitles.filter((t) => !/disclaimer|safety/i.test(t)).slice(0, 3);
  const path = `/u/${product.handle}`;

  return (
    <section>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.title,
          description: product.promise,
          url: absoluteUrl(path),
          brand: { "@type": "Brand", name: product.creatorName },
          offers: {
            "@type": "Offer",
            price,
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: absoluteUrl(path),
          },
        }}
      />
      <header className="bar">
        <div className="bar-in">
          <div className="avatar">
            {product.creatorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- storage-hosted avatar, not worth next/image remote-pattern config
              <img
                className="avatar-img"
                src={product.creatorAvatarUrl}
                alt={product.creatorName}
                referrerPolicy="no-referrer"
              />
            ) : (
              product.creatorName[0]?.toUpperCase()
            )}
          </div>
          <div className="who">
            <b>{product.creatorName}</b>
            <span>@{product.handle} · built from their audience</span>
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="hero">
          <div className="micro">
            Personalized ·{product.durationDays ? ` ${product.durationDays} days ·` : ""}{" "}
            {product.questions.length} questions first
          </div>
          <h1 style={{ marginTop: 18 }}>{product.title}</h1>
          <p className="lede-strong">{product.promise}</p>

          <div className="price-line">
            <span className="amt">${price}</span>
            <span className="note">
              One payment. Yours to keep: web, PDF, and email.
            </span>
          </div>

          <div style={{ marginTop: 30, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <Link className="btn btn-primary btn-lg" href={`/u/${product.handle}/quiz`}>
              Start the {product.questions.length}-question quiz
            </Link>
            <span style={{ fontSize: 13.5, color: "var(--sage)" }}>Takes about 2 minutes</span>
          </div>
        </div>

        <div className="covers">
          {covers.map((title, i) => (
            <div className="cov" key={title}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
            </div>
          ))}
        </div>

        <div className="strip">
          <p className="q">
            The quiz works out which kind of person you are. The plan you get is written for that
            person: different buyers get materially different plans.
          </p>
          <Link className="btn btn-outline" href={`/u/${product.handle}/quiz`}>
            Take the quiz
          </Link>
        </div>
      </main>

      <footer className="powered-by">
        <span>Powered by</span>
        <Wordmark size={15} />
      </footer>
    </section>
  );
}
