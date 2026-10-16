"use client";

import { useState } from "react";

const TYPES = [
  { value: "illegal", label: "Illegal content (suspected minor, trafficking)" },
  { value: "non_consensual", label: "Non-consensual / image-based abuse" },
  { value: "copyright", label: "Copyright infringement" },
  { value: "privacy", label: "Privacy / personal data" },
  { value: "other", label: "Other" },
];

export function ReportForm({ videoId }: { videoId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          videoId,
          requestType: form.get("requestType"),
          reason: form.get("reason"),
          reporterContact: form.get("reporterContact") || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Something went wrong. Please try again.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="mt-6 rounded-lg border border-night-600 bg-night-900 p-6 text-sm">
        <p className="font-medium text-accent-400">Report received</p>
        <p className="mt-2 text-neutral-400">
          Thank you. Our moderation team reviews every report. If the content is
          unlawful it will be suppressed immediately.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block text-neutral-300">Reason category</span>
        <select
          name="requestType"
          required
          className="w-full rounded-md bg-night-800 border border-night-600 px-3 py-2"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-neutral-300">Details</span>
        <textarea
          name="reason"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          className="w-full rounded-md bg-night-800 border border-night-600 px-3 py-2"
          placeholder="Describe the issue…"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-neutral-300">
          Contact email <span className="text-neutral-600">(optional)</span>
        </span>
        <input
          type="email"
          name="reporterContact"
          maxLength={320}
          className="w-full rounded-md bg-night-800 border border-night-600 px-3 py-2"
        />
      </label>
      {state === "error" && <p className="text-sm text-red-400">{message}</p>}
      <button
        type="submit"
        disabled={state === "busy"}
        className="rounded-md bg-accent-600 px-5 py-2 text-sm font-medium hover:bg-accent-500 disabled:opacity-50"
      >
        {state === "busy" ? "Sending…" : "Submit report"}
      </button>
    </form>
  );
}
