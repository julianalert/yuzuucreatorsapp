import { notFound } from "next/navigation";
import { productForViewer } from "@/lib/public";
import { getSignedInUser } from "@/lib/auth";
import { Wordmark } from "@/components/Wordmark";
import { QuizClient } from "@/components/QuizClient";
import { PreviewBanner } from "@/components/PreviewBanner";

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { handle } = await params;
  const { preview } = await searchParams;
  const viewer = await getSignedInUser();
  const { product, isPreview, previewKind } = await productForViewer(handle, viewer?.id, preview);
  if (!product) notFound();

  return (
    <section>
      {isPreview ? (
        <PreviewBanner kind={previewKind}>
          answer it like a follower would; nothing is tracked.
        </PreviewBanner>
      ) : null}
      <header className="bar">
        <div className="bar-in">
          <span className="avatar" aria-hidden="true">
            {product.creatorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external OAuth avatar, not worth next/image remote-pattern config
              <img className="avatar-img" src={product.creatorAvatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              product.creatorName[0]?.toUpperCase()
            )}
          </span>
          <div className="who">
            <b>{product.title}</b>
            <span>by {product.creatorName}</span>
          </div>
        </div>
      </header>
      <QuizClient
        handle={product.handle}
        questions={product.questions}
        isPreview={isPreview}
        previewToken={previewKind === "token" ? preview : undefined}
      />
      <footer className="powered-by">
        <span>Powered by</span>
        <Wordmark size={15} />
      </footer>
    </section>
  );
}
