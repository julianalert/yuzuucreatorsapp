import { notFound } from "next/navigation";
import { publishedProductByHandle } from "@/lib/public";
import { Wordmark } from "@/components/Wordmark";
import { CheckoutClient } from "@/components/CheckoutClient";
import { CheckoutSummary } from "@/components/CheckoutSummary";
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
  const inside = product.sections.filter((s) => !/disclaimer|safety/i.test(s.title));

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
          <div className="micro">Quiz complete · almost there</div>
          <h1 style={{ marginTop: 14, fontSize: 32 }}>Your plan is ready to be written.</h1>
          <p className="lede" style={{ marginBottom: 30 }}>
            Not a template with your name pasted in — written start to finish from what you just
            told us.
          </p>

          <CheckoutSummary handle={product.handle} questions={product.questions} />

          <div className="co-sec">
            <span className="micro">What&apos;s inside</span>
            <div className="inside">
              {inside.map((s, i) => (
                <div key={s.id} className="inside-row">
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{s.title}</h3>
                    {s.description ? <p>{s.description}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="co-sec">
            <span className="micro">How delivery works</span>
            <div className="co-tl">
              <div className="co-tl-step">
                <span className="dot" />
                <div>
                  <span className="t">Now</span>
                  <b style={{ display: "block" }}>You pay</b>
                  <p>Your answers are locked in and the writing starts immediately.</p>
                </div>
              </div>
              <div className="co-tl-step">
                <span className="dot" />
                <div>
                  <span className="t">~1 minute</span>
                  <b style={{ display: "block" }}>Your plan is written</b>
                  <p>
                    One document, built section by section from your answers and{" "}
                    {product.creatorName}&apos;s method.
                  </p>
                </div>
              </div>
              <div className="co-tl-step">
                <span className="dot" />
                <div>
                  <span className="t">Then</span>
                  <b style={{ display: "block" }}>Delivered</b>
                  <p>A private link, emailed to you and yours to keep. Save it as a PDF any time.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="summary">
          <div className="sum-hd">
            <span className="micro">You&apos;re getting</span>
            <h2>{product.title}</h2>
          </div>
          <div className="sum-body">
            <ul className="built">
              <li>{inside.length} sections, each written from your answers</li>
              {product.durationDays ? <li>A {product.durationDays}-day plan paced to your situation</li> : null}
              <li>Private web page — yours to keep, printable</li>
              <li>Reviewed and approved by {product.creatorName} before going live</li>
            </ul>
          </div>
          <div className="sum-total">
            <span className="k">Total</span>
            <span className="v">${price}</span>
          </div>
          <div className="sum-foot">
            <CheckoutClient
              handle={product.handle}
              action={createOrder}
              emailError={error === "email"}
            />
            <div className="trust">
              <span>Secure checkout</span>
              <span>14-day guarantee</span>
              <span>One-time payment</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
