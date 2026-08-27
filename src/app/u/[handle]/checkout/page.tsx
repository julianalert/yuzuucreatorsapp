import { notFound } from "next/navigation";
import { publishedProductByHandle } from "@/lib/public";
import { Wordmark } from "@/components/Wordmark";
import { CheckoutClient } from "@/components/CheckoutClient";
import { createOrder } from "./actions";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { handle } = await params;
  const { error } = await searchParams;
  const product = await publishedProductByHandle(handle);
  if (!product) notFound();

  const price = (product.priceCents / 100).toFixed(0);
  const built = product.sectionTitles.filter((t) => !/disclaimer|safety/i.test(t)).slice(0, 5);

  return (
    <section>
      <header className="bar">
        <div className="bar-in">
          <div className="who">
            <b>{product.title}</b>
            <span>by {product.creatorName}</span>
          </div>
          <div className="right">
            <Wordmark href={`/u/${product.handle}`} />
          </div>
        </div>
      </header>

      <div className="co">
        <div>
          <div className="micro">Almost there</div>
          <h1 style={{ marginTop: 14, fontSize: 32 }}>Your plan is ready to be written.</h1>
          <p className="lede" style={{ marginBottom: 34 }}>
            We&apos;ve got your answers. Pay and we start writing — it takes about a minute.
          </p>
          <CheckoutClient handle={product.handle} action={createOrder} emailError={error === "email"} />
        </div>

        <aside className="summary">
          <div className="sum-hd">
            <span className="micro">You&apos;re getting</span>
            <h2>{product.title}</h2>
          </div>
          <div className="sum-body">
            <ul className="built">
              {built.map((t) => (
                <li key={t}>{t}</li>
              ))}
              <li>Personalized to your quiz answers</li>
              <li>Web version + PDF + email delivery</li>
            </ul>
          </div>
          <div className="sum-total">
            <span className="k">Total</span>
            <span className="v">${price}</span>
          </div>
          <div className="sum-foot">
            <p className="guarantee">
              Built from what {product.creatorName} actually teaches — reviewed and approved by
              them before going live.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
