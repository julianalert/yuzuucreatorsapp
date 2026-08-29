import { notFound } from "next/navigation";
import Link from "next/link";
import { productForViewer } from "@/lib/public";
import { getSignedInUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import { CheckoutClient, type RestoredQuiz } from "@/components/CheckoutClient";
import { CheckoutSummary } from "@/components/CheckoutSummary";
import { createOrder } from "./actions";

/**
 * Abandoned-checkout recovery lands here with ?session=<id> — often on a
 * different device, where sessionStorage is empty. Rebuild the checkout state
 * from the tracked quiz session so the click actually converts.
 */
async function restoredSession(
  sessionId: string | undefined,
  blueprintId: string
): Promise<RestoredQuiz | null> {
  if (!sessionId) return null;
  const { data } = await supabaseAdmin()
    .from("quiz_sessions")
    .select("id, blueprint_id, answers, email, order_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || data.blueprint_id !== blueprintId || data.order_id) return null;
  if (!data.answers || !Object.keys(data.answers).length) return null;
  return {
    answers: JSON.stringify(data.answers),
    sessionId: data.id,
    email: data.email ?? "",
  };
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ error?: string; session?: string }>;
}) {
  const { handle } = await params;
  const { error, session } = await searchParams;
  const viewer = await getSignedInUser();
  const { product, isPreview } = await productForViewer(handle, viewer?.id);
  if (!product) notFound();

  const restored = isPreview ? null : await restoredSession(session, product.blueprintId);
  const price = (product.priceCents / 100).toFixed(0);
  const inside = product.sections.filter((s) => !/disclaimer|safety/i.test(s.title));

  return (
    <section>
      {isPreview ? (
        <div className="preview-note">
          <b>Preview</b> — buyers see a Pay button here; your walkthrough never creates an order.
          <Link href="/dashboard">Back to dashboard</Link>
        </div>
      ) : null}
      <header className="bar">
        <div className="bar-in">
          <div className="avatar">
            {product.creatorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external OAuth avatar, not worth next/image remote-pattern config
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
            <b>{product.title}</b>
            <span>by {product.creatorName}</span>
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

          <CheckoutSummary
            handle={product.handle}
            questions={product.questions}
            restoredAnswers={restored?.answers ?? null}
          />

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
              isPreview={isPreview}
              restored={restored}
            />
            <div className="trust">
              <span>Secure checkout</span>
              <span>14-day guarantee</span>
              <span>One-time payment</span>
            </div>
          </div>
        </aside>
      </div>

      <footer className="powered-by">
        <span>Powered by</span>
        <Wordmark size={15} />
      </footer>
    </section>
  );
}
