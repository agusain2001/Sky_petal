import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./cinematic.css";
import "./landing-motion.css";
import { StoreProvider } from "@/components/store-provider";
import { Header, Footer } from "@/components/chrome";
import { indexingEnabled } from "@/lib/seo";
const serif = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2",
      weight: "300 700",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-serif",
  preload: false,
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
const sans = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
      weight: "100 1000",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  preload: false,
  display: "swap",
  adjustFontFallback: "Arial",
});
export const metadata: Metadata = {
  robots: indexingEnabled() ? undefined : { index: false, follow: false },
  title: {
    default: "Sky Petal — Softness, in every sense.",
    template: "%s | Sky Petal",
  },
  description:
    "Thoughtfully made intimates, silk sleepwear, and little self-care rituals. Discover your everyday kind of luxury at Sky Petal.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${serif.variable} ${sans.variable}`}
    >
      <body>
        <StoreProvider>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </StoreProvider>
      </body>
    </html>
  );
}
