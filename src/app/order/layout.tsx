import type { Metadata } from "next";
import { noIndex } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Your plan — Yuzuu",
  ...noIndex,
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
