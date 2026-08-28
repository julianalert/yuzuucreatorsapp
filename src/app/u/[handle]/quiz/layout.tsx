import type { Metadata } from "next";
import { noIndex } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Quiz — Yuzuu",
  ...noIndex,
};

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
