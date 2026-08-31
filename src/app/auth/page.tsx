import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth";
import { GoogleButton } from "@/components/GoogleButton";
import { Wordmark } from "@/components/Wordmark";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const user = await getSignedInUser();
  if (user) redirect(next || "/onboard");

  return (
    <section>
      <div className="hero-center">
        <div className="center" style={{ textAlign: "center" }}>
          <Wordmark size={26} href="/" />
          <h1 style={{ marginTop: 36 }}>Start earning from the audience you&apos;ve already built</h1>
          <p className="lede" style={{ marginInline: "auto" }}>
            We&apos;ll turn your Instagram into a personalized product for your
            audience and a page to sell it from.
          </p>

          <div style={{ marginTop: 38 }}>
            <GoogleButton next={next || "/onboard"} />
            {error ? (
              <p className="hint" style={{ marginTop: 14 }}>
                Sign-in didn&apos;t complete — try again.
              </p>
            ) : null}
            <p className="legal">
              By continuing you agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                terms
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                privacy policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
