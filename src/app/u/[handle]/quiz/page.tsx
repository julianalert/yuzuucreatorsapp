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
          <div className="who">
            <b>{product.title}</b>
            <span>by {product.creatorName}</span>
          </div>
          <div className="right">
            <Wordmark href={`/u/${product.handle}`} />
          </div>
        </div>
      </header>
      <QuizClient handle={product.handle} questions={product.questions} />
    </section>
  );
}
