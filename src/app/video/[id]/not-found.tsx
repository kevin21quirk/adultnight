import Link from "next/link";

export default function VideoNotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-semibold">Video unavailable</h1>
      <p className="mt-3 text-sm text-neutral-400">
        This video has been removed, is pending review, or never existed in our
        catalogue.
      </p>
      <Link href="/" className="mt-6 inline-block rounded-md bg-accent-600 px-5 py-2 text-sm font-medium hover:bg-accent-500">
        Back to browse
      </Link>
    </div>
  );
}
