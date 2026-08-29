import { ImageResponse } from "next/og";
import { publishedProductByHandle } from "@/lib/public";

export const runtime = "nodejs";

const C = {
  paper: "#f4f5f0",
  ink: "#16201b",
  inkSoft: "#3d4b43",
  sage: "#6e7c73",
  line: "#d9ded4",
  zest: "#b9cc3a",
};

/**
 * Per-product share image. A shared yuzuu.co/u/<handle> link should sell the
 * creator's product — title, promise, price — not the Yuzuu brand.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const product = await publishedProductByHandle(handle);
  if (!product) return new Response("Not found", { status: 404 });

  const price = (product.priceCents / 100).toFixed(0);
  const title = product.title.length > 70 ? `${product.title.slice(0, 67)}…` : product.title;
  const promise =
    product.promise.length > 140 ? `${product.promise.slice(0, 137)}…` : product.promise;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: C.paper,
          padding: "64px 72px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              background: C.zest,
              display: "flex",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: C.ink }}>
              {product.creatorName}
            </span>
            <span style={{ fontSize: 22, color: C.sage }}>
              @{product.handle} · built from their audience
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span
            style={{
              fontSize: 62,
              fontWeight: 700,
              color: C.ink,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </span>
          <span style={{ fontSize: 28, color: C.inkSoft, lineHeight: 1.4 }}>{promise}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                display: "flex",
                padding: "10px 22px",
                background: C.ink,
                color: C.paper,
                borderRadius: 6,
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              ${price}
            </span>
            <span style={{ fontSize: 24, color: C.sage }}>
              Personalized to you · {product.questions.length}-question quiz
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: C.zest, display: "flex" }} />
            <span style={{ fontSize: 26, fontWeight: 700, color: C.ink }}>yuzuu</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
