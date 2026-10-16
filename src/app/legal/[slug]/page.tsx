import { notFound } from "next/navigation";

const SITE_NAME = process.env.SITE_NAME || "AfterDark Index";

const PAGES: Record<string, { title: string; body: React.ReactNode }> = {
  terms: {
    title: "Terms of Service",
    body: (
      <>
        <p>
          {SITE_NAME} is an adult video discovery index. All videos are hosted by
          and embedded from third-party providers; we do not host, copy or
          redistribute video files.
        </p>
        <p>
          You must be at least 18 years old (or the age of majority in your
          jurisdiction) to use this site. By using it you confirm that adult
          content is legal where you live.
        </p>
        <p>
          Content remains the property of its providers and rights holders.
          Trademarks belong to their respective owners.
        </p>
      </>
    ),
  },
  privacy: {
    title: "Privacy Notice",
    body: (
      <>
        <p>
          We store the minimum data needed to run this service: an age-assurance
          cookie, and — if you submit a report — the report text and any contact
          address you choose to share.
        </p>
        <p>
          Report data is retained for 12 months after resolution for audit and
          legal purposes, then deleted. Access to reports is restricted to
          administrators.
        </p>
        <p>
          Embedded players are served by third-party providers who may process
          your data under their own privacy policies.
        </p>
      </>
    ),
  },
  "content-removal": {
    title: "Content Removal & Takedown",
    body: (
      <>
        <p>
          To request removal of a video, use the “Report this video” link on its
          page. Reports of suspected minors, non-consensual content or
          trafficking are prioritised and the item is suppressed immediately on
          review.
        </p>
        <p>
          Because we only embed provider content, removing the video at the
          source provider also removes it here. Our import pipeline honours the
          provider’s deletion feed automatically.
        </p>
        <p>
          For copyright claims, include identification of the work and your
          contact details in the report.
        </p>
      </>
    ),
  },
  "2257": {
    title: "18 U.S.C. § 2257 Statement",
    body: (
      <>
        <p>
          {SITE_NAME} does not produce or host any video content. All videos are
          embedded from third-party providers who are responsible for
          maintaining records required by 18 U.S.C. § 2257.
        </p>
        <p>
          Each video page links to the original provider where compliance
          information is maintained.
        </p>
      </>
    ),
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">{page.title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-neutral-300">
        {page.body}
      </div>
    </div>
  );
}
