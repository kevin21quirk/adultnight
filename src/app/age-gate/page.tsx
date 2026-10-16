import Link from "next/link";
import { ageMode, externalProviderUrl } from "@/lib/age-gate";
import { AgeConfirm } from "./age-confirm";

const SITE_NAME = process.env.SITE_NAME || "AfterDark Index";

export const metadata = { title: "Age verification" };
export const dynamic = "force-dynamic";

export default async function AgeGatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const mode = ageMode();
  const providerUrl = externalProviderUrl();
  const nextPath =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <h1 className="text-2xl font-bold">{SITE_NAME}</h1>
      <p className="mt-4 text-neutral-300">
        This website contains age-restricted adult material. You must be 18 or
        older — or the age of majority in your jurisdiction — to continue.
      </p>

      {mode === "self_declaration" && <AgeConfirm next={nextPath} />}

      {mode === "external" &&
        (providerUrl ? (
          <a
            href={`${providerUrl}?return=${encodeURIComponent(nextPath)}`}
            className="mt-8 rounded-md bg-accent-600 px-8 py-3 font-medium hover:bg-accent-500"
          >
            Verify your age
          </a>
        ) : (
          <p className="mt-8 rounded-md border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            Age verification is temporarily unavailable. Please check back later.
          </p>
        ))}

      {mode === "blocked" && (
        <p className="mt-8 rounded-md border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          Age verification is required but not yet configured on this site.
        </p>
      )}

      <a
        href="https://www.google.com"
        className="mt-6 text-sm text-neutral-500 hover:text-neutral-300"
      >
        Exit
      </a>
      <p className="mt-8 text-xs text-neutral-600">
        By entering you confirm you are of legal age and agree to our{" "}
        <Link href="/legal/terms" className="underline">Terms</Link> and{" "}
        <Link href="/legal/privacy" className="underline">Privacy Notice</Link>.
      </p>
    </div>
  );
}
