import type { ProviderAdapter } from "./types";
import { pornhubAdapter } from "./pornhub";

const adapters: Record<string, ProviderAdapter> = {
  [pornhubAdapter.slug]: pornhubAdapter,
};

export function getAdapter(slug: string): ProviderAdapter | null {
  return adapters[slug] ?? null;
}

export function allAdapters(): ProviderAdapter[] {
  return Object.values(adapters);
}

export function adapterForEmbedUrl(url: string): ProviderAdapter | null {
  for (const a of Object.values(adapters)) {
    if (a.validateEmbedUrl(url)) return a;
  }
  return null;
}

export function adapterForSourceUrl(url: string): ProviderAdapter | null {
  for (const a of Object.values(adapters)) {
    if (a.videoIdFromUrl(url)) return a;
  }
  return null;
}
