import type { Metadata } from "next";
import { noIndex } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Log in — Yuzuu",
  ...noIndex,
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
