import { ImageResponse } from "next/og";

export const alt = "Yuzuu — Earn regular income from your audience";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#fbfcf5",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#5e8c4a", marginBottom: 24 }}>
          yuzuu
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: "#0c1a13",
            lineHeight: 1.1,
            maxWidth: 980,
          }}
        >
          Earn regular income from your audience
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#4c5c51", marginTop: 28 }}>
          We build the product. You keep 70% of every sale.
        </div>
      </div>
    ),
    { ...size }
  );
}
