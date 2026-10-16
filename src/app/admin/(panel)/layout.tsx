import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../actions";

const NAV = [
  ["Overview", "/admin"],
  ["Videos", "/admin/videos"],
  ["Providers", "/admin/providers"],
  ["Imports", "/admin/imports"],
  ["Moderation", "/admin/moderation"],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <div className="flex gap-8">
      <aside className="w-44 shrink-0">
        <p className="mb-4 text-xs uppercase tracking-wide text-neutral-500">
          Admin · {user}
        </p>
        <nav className="flex flex-col gap-1 text-sm">
          {NAV.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded px-3 py-2 text-neutral-300 hover:bg-night-800 hover:text-white"
            >
              {label}
            </Link>
          ))}
          <form action={logoutAction} className="mt-4">
            <button className="w-full rounded px-3 py-2 text-left text-neutral-500 hover:bg-night-800 hover:text-white">
              Log out
            </button>
          </form>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
