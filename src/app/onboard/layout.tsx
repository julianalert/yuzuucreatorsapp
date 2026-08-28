import type { Metadata } from "next";
import { noIndex } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Onboarding — Yuzuu",
  ...noIndex,
};

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
