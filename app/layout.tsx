import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SkipLink } from "@/components/ui/SkipLink";
import "./globals.css";

/*
 * The three loaded families. The variable names stay distinct from the
 * @theme token names in globals.css — two definitions of one custom property
 * would silently break the stack.
 *
 * The variable classes go on <html>, not <body>: the @theme tokens are
 * declared on :root, which is <html>, so a variable declared on <body>
 * would be invisible to them and the fonts would fall back.
 */
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const sans = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DartHub",
  description: "Modular, server-authoritative multiplayer dart game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <SkipLink />
        <SiteHeader />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1440px] flex-col px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] scroll-mt-14 md:px-8 md:pb-0"
        >
          {children}
          <SiteFooter />
        </main>
      </body>
    </html>
  );
}
