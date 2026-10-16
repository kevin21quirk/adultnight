"use client";

import { useState } from "react";

export function AgeConfirm({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/age-gate", { method: "POST" });
      if (!res.ok) throw new Error();
      window.location.href = next;
    } catch {
      setBusy(false);
      setError("Could not verify. Please try again.");
    }
  }

  return (
    <div className="mt-8">
      <button
        onClick={confirm}
        disabled={busy}
        className="rounded-md bg-accent-600 px-8 py-3 font-medium hover:bg-accent-500 disabled:opacity-50"
      >
        I am 18 or older — enter
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
