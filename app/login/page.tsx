
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

type UserRole = "admin" | "customer" | "technician";

interface LoginResponse {
  message?: string;
  error?: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: UserRole;
  };
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Sign in failed. Please try again.");
        return;
      }

      if (!data.user) {
        setMessage("Login response did not contain user information.");
        return;
      }

      let destination: string;

      switch (data.user.role) {
        case "admin":
          destination = "/admin";
          break;
        case "technician":
          destination = "/technician";
          break;
        case "customer":
          destination = "/";
          break;
        default:
          setMessage("Your account has an unsupported role.");
          return;
      }

      setPassword("");
      setMessage("Login successful! Redirecting...");

      // Allow the browser to store the new session cookie before navigation.
      window.location.replace(destination);
    } catch (error) {
      console.error("Login page error:", error);
      setMessage("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl sm:p-11">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 text-4xl font-bold text-white">
            W
          </div>

          <h1 className="text-3xl font-bold text-slate-950">
            Welcome to WarrantIQ
          </h1>

          <p className="mt-3 text-lg text-slate-500">
            Sign in to manage your products and warranties
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block font-medium text-slate-900"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block font-medium text-slate-900"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-4 text-xl font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          {message && (
            <p
              role="status"
              aria-live="polite"
              className="rounded-xl bg-blue-50 p-4 text-blue-800"
            >
              {message}
            </p>
          )}
        </form>

        <p className="mt-7 text-center text-sm text-slate-500">
          Digital Warranty &amp; Product Service Management
        </p>
      </section>
    </main>
  );
}
