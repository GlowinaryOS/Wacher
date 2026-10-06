import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AppNav, NavLinks } from "@/components/layout/AppNav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Watcher", template: "%s · Watcher" },
  description: "Private market research, analysis and forward-testing terminal. Not a trading bot.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
              <span className="text-sm font-bold tracking-[0.25em] text-text">WATCHER</span>
            </Link>
            <Suspense fallback={<NavLinks />}>
              <AppNav />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-[1600px] px-4 py-3 text-[11px] leading-relaxed text-faint">
            Watcher is a research and decision-support tool. It never places trades. Probabilities are estimates, not
            guarantees. You make every real-money decision yourself.
          </div>
        </footer>
      </body>
    </html>
  );
}
