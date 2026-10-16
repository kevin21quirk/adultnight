import { loginAction } from "../actions";
import { getAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getAdmin()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-xl font-semibold">Admin sign in</h1>
      {error === "credentials" && (
        <p className="mt-3 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          Invalid username or password.
        </p>
      )}
      {error === "rate" && (
        <p className="mt-3 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          Too many attempts. Try again later.
        </p>
      )}
      <form action={loginAction} className="mt-6 space-y-4">
        <input
          name="username"
          required
          autoComplete="username"
          placeholder="Username"
          className="w-full rounded-md bg-night-800 border border-night-600 px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          className="w-full rounded-md bg-night-800 border border-night-600 px-3 py-2 text-sm"
        />
        <button className="w-full rounded-md bg-accent-600 px-4 py-2 text-sm font-medium hover:bg-accent-500">
          Sign in
        </button>
      </form>
    </div>
  );
}
