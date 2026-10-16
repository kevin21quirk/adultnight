"use client";

import { useState } from "react";

const inputCls =
  "w-20 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-center text-sm focus:border-accent-500 focus:outline-none";

export function AgeConfirm({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/age-gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          day: fd.get("day"),
          month: fd.get("month"),
          year: fd.get("year"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not verify. Please try again.");
        setBusy(false);
        return;
      }
      window.location.href = next;
    } catch {
      setBusy(false);
      setError("Could not verify. Please try again.");
    }
  }

  return (
    <form onSubmit={confirm} className="mt-8 flex flex-col items-center">
      <label className="text-sm text-neutral-300">
        Enter your date of birth
      </label>
      <div className="mt-3 flex items-center gap-2">
        <input
          name="day"
          inputMode="numeric"
          placeholder="DD"
          maxLength={2}
          required
          className={inputCls}
          aria-label="Day"
        />
        <input
          name="month"
          inputMode="numeric"
          placeholder="MM"
          maxLength={2}
          required
          className={inputCls}
          aria-label="Month"
        />
        <input
          name="year"
          inputMode="numeric"
          placeholder="YYYY"
          maxLength={4}
          required
          className="w-24 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-center text-sm focus:border-accent-500 focus:outline-none"
          aria-label="Year"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-5 rounded-md bg-accent-600 px-8 py-3 font-medium hover:bg-accent-500 disabled:opacity-50"
      >
        Verify and enter
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </form>
  );
}
