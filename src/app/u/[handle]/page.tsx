import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publishedProductByHandle } from "@/lib/public";
import { Wordmark } from "@/components/Wordmark";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const product = await publishedProductByHandle(handle);
  if (!product) return { title: "Yuzuu" };
  return {
    title: `${product.title} — ${product.creatorName}`,
    description: product.promise,
  };
}

export default async function SalesPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const product = await publishedProductByHandle(handle);
  if (!product) notFound();

  const price = (product.priceCents / 100).toFixed(0);
  const covers = product.sectionTitles.filter((t) => !/disclaimer|safety/i.test(t)).slice(0, 3);

  return (
    <section>
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

      <div className="wrap">
        <div className="hero">
          <div className="micro">
            Personalized ·{product.durationDays ? ` ${product.durationDays} days ·` : ""}{" "}
            {product.questions.length} questions first
          </div>
          <h1 style={{ marginTop: 18 }}>{product.title}</h1>
          <p className="lede-strong">{product.promise}</p>
          {product.credibility ? (
            <p style={{ marginTop: 16, fontSize: 14.5, color: "var(--sage)" }}>
              {product.credibility}
            </p>
          ) : null}

          <div className="price-line">
            <span className="amt">${price}</span>
            <span className="note">
              One payment. Yours to keep — web, PDF, and email.
            </span>
          </div>

          <div style={{ marginTop: 30, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <Link className="btn btn-primary btn-lg" href={`/u/${product.handle}/quiz`}>
              Start the {product.questions.length}-question quiz
            </Link>
            <span style={{ fontSize: 13.5, color: "var(--sage)" }}>
              Takes about 2 minutes · see your version before paying anything? No — but there&apos;s
              a guarantee.
            </span>
          </div>
        </div>

        <div className="covers">
          {covers.map((title, i) => (
            <div className="cov" key={title}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>Written for your answers — not a template with your name pasted in.</p>
            </div>
          ))}
        </div>

        <div className="strip">
          <p className="q">
            The quiz works out which kind of person you are. The plan you get is written for that
            person — different buyers get materially different plans.
          </p>
          <Link className="btn btn-outline" href={`/u/${product.handle}/quiz`}>
            Take the quiz
          </Link>
        </div>
      </div>

      <footer className="powered-by">
        <span>Powered by</span>
        <Wordmark size={15} />
      </footer>
    </section>
  );
}
