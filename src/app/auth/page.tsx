import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth";
import { GoogleButton } from "@/components/GoogleButton";
import { Wordmark } from "@/components/Wordmark";
import { devSignIn } from "./actions";

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
          <h1 style={{ marginTop: 36 }}>Turn what you know into something people buy.</h1>
          <p className="lede" style={{ marginInline: "auto" }}>
            Give us your Instagram handle. We&apos;ll build a personalized product for your
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
              By continuing you agree to the <a href="#">terms</a> and{" "}
              <a href="#">privacy policy</a>.
            </p>

            {process.env.NEXT_PUBLIC_DEV_LOGIN === "true" ? (
              <form action={devSignIn} style={{ marginTop: 34, textAlign: "left" }}>
                <span className="micro">Dev sign-in (local only)</span>
                <div className="field" style={{ marginTop: 12 }}>
                  <input type="email" name="email" placeholder="dev@example.com" required />
                </div>
                <div className="field" style={{ marginTop: 8 }}>
                  <input
                    type="password"
                    name="password"
                    placeholder="password (min 6 chars)"
                    required
                  />
                </div>
                <button className="btn btn-outline btn-block" type="submit" style={{ marginTop: 10 }}>
                  Sign in
                </button>
                {error === "dev" ? (
                  <p className="hint">Dev sign-in failed — check the Supabase keys in .env.local.</p>
                ) : null}
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
