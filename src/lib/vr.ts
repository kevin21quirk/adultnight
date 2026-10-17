export type VrMode = "mono360" | "sbs180" | "sbs360";

export const VR_MODES: VrMode[] = ["mono360", "sbs180", "sbs360"];

/**
 * Detect virtual-reality content from catalogue metadata. VR providers tag
 * inconsistently, so check categories and tags liberally.
 */
export function isVrVideo(categorySlugs: string[], tags: string[]): boolean {
  const re = /virtual.?reality|^vr$|^vr[- ]?porn|^vr[- ]?180/i;
  return categorySlugs.some((c) => re.test(c)) || tags.some((t) => re.test(t));
}

/**
 * Pick the sphere projection for a direct media URL.
 * Explicit admin-set mode wins; otherwise infer: most adult VR is 180°
 * side-by-side stereo; titles/tags mentioning 360 usually mean
 * equirectangular mono.
 */
export function inferVrMode(
  explicit: string | null,
  title: string,
  tags: string[]
): VrMode {
  if (explicit && (VR_MODES as string[]).includes(explicit)) {
    return explicit as VrMode;
  }
  const hay = `${title} ${tags.join(" ")}`;
  return /360/.test(hay) ? "mono360" : "sbs180";
}
