import { notFound } from "next/navigation";
import { publishedProductByHandle } from "@/lib/public";
import { Wordmark } from "@/components/Wordmark";
import { QuizClient } from "@/components/QuizClient";

export default async function QuizPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const product = await publishedProductByHandle(handle);
  if (!product) notFound();

  return (
    <section>
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
      <QuizClient handle={product.handle} questions={product.questions} />
      <footer className="powered-by">
        <span>Powered by</span>
        <Wordmark size={15} />
      </footer>
    </section>
  );
}
