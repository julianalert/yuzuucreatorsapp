import type { Metadata } from "next";
import {
  Newsreader,
  Schibsted_Grotesk,
  JetBrains_Mono,
  Fraunces,
  Martian_Mono,
} from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-schibsted",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
});

// landing page ("Rind" design system) only
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
});

const martian = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-martian",
});

export const metadata: Metadata = {
  title: "Yuzuu",
  description:
    "Give us your Instagram handle. We'll build a personalized product for your audience and a page to sell it from.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${schibsted.variable} ${jetbrains.variable} ${fraunces.variable} ${martian.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
