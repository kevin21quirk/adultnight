import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string>;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams({ ...params, page: String(p) });
    return `${basePath}?${sp.toString()}`;
  };
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
  );

  return (
    <nav className="mt-8 flex items-center justify-center gap-1 text-sm" aria-label="Pagination">
      {page > 1 && (
        <Link href={href(page - 1)} className="rounded px-3 py-1.5 bg-night-800 hover:bg-night-700">
          ‹ Prev
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-neutral-600">…</span>}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={`rounded px-3 py-1.5 ${
              p === page ? "bg-accent-600 text-white" : "bg-night-800 hover:bg-night-700"
            }`}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages && (
        <Link href={href(page + 1)} className="rounded px-3 py-1.5 bg-night-800 hover:bg-night-700">
          Next ›
        </Link>
      )}
    </nav>
  );
}
