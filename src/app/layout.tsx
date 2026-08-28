import type { Metadata } from "next";
import Script from "next/script";
import {
  Bricolage_Grotesque,
  DM_Mono,
  Newsreader,
  Schibsted_Grotesk,
  JetBrains_Mono,
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

// landing page ("Peel" design system) only
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "Yuzuu",
  description:
    "Hand us your Instagram handle. We build the whole product — sales page, quiz, and a plan written for each buyer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${schibsted.variable} ${jetbrains.variable} ${bricolage.variable} ${dmMono.variable}`}
    >
      <body>
        {children}
        <Script src="https://scripts.simpleanalyticscdn.com/latest.js" />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element -- Simple Analytics noscript beacon */}
          <img
            src="https://queue.simpleanalyticscdn.com/noscript.gif"
            alt=""
            referrerPolicy="no-referrer-when-downgrade"
          />
        </noscript>
      </body>
    </html>
  );
}
