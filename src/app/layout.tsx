import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const SITE_NAME = process.env.SITE_NAME || "AfterDark Index";

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} — adult video discovery`, template: `%s · ${SITE_NAME}` },
  description:
    "A free adult video discovery index. Videos are embedded from and hosted by their original providers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-night-700 bg-night-900/80 backdrop-blur sticky top-0 z-40">
          <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-6">
            <Link href="/" className="font-bold text-lg tracking-tight text-accent-400">
              {SITE_NAME}
            </Link>
            <form action="/search" className="flex-1 max-w-xl" role="search">
              <input
                type="search"
                name="q"
                placeholder="Search videos…"
                className="w-full rounded-full bg-night-800 border border-night-600 px-4 py-1.5 text-sm placeholder:text-neutral-500 focus:outline-none focus:border-accent-500"
              />
            </form>
            <nav className="hidden sm:flex gap-4 text-sm text-neutral-400">
              <Link href="/search" className="hover:text-white">Browse</Link>
              <Link href="/legal/content-removal" className="hover:text-white">Content removal</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
        <footer className="border-t border-night-700 mt-10">
          <div className="mx-auto max-w-7xl px-4 py-8 text-xs text-neutral-500 flex flex-wrap gap-x-6 gap-y-2">
            <span>© {new Date().getFullYear()} {SITE_NAME}</span>
            <span>All videos are embedded from and hosted by third-party providers.</span>
            <Link href="/legal/terms" className="hover:text-neutral-300">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-neutral-300">Privacy</Link>
            <Link href="/legal/content-removal" className="hover:text-neutral-300">Content removal</Link>
            <Link href="/legal/2257" className="hover:text-neutral-300">18 U.S.C. 2257</Link>
            <a href="https://www.rtalabel.org" rel="nofollow noopener" className="hover:text-neutral-300">RTA</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
