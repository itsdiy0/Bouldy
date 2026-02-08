"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#37353E" }}
    >
      <div
        className="w-full max-w-md p-8 rounded-xl"
        style={{ backgroundColor: "#715A5A40" }}
      >
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/Bouldy.webp"
            alt="Bouldy Logo"
            width={80}
            height={80}
            className="mb-4"
          />
          <h1 className="text-2xl font-bold" style={{ color: "#D3DAD9" }}>
            Welcome back
          </h1>
          <p className="mt-1" style={{ color: "#D3DAD9", opacity: 0.6 }}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="p-3 rounded-lg text-sm text-center"
              style={{ backgroundColor: "#ef444420", color: "#ef4444" }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              className="block text-sm mb-2"
              style={{ color: "#D3DAD9", opacity: 0.8 }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg outline-none transition-colors"
              style={{
                backgroundColor: "#37353E",
                color: "#D3DAD9",
                border: "1px solid #715A5A",
              }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              className="block text-sm mb-2"
              style={{ color: "#D3DAD9", opacity: 0.8 }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg outline-none transition-colors"
              style={{
                backgroundColor: "#37353E",
                color: "#D3DAD9",
                border: "1px solid #715A5A",
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-lg font-medium transition-colors mt-6"
            style={{
              backgroundColor: "#715A5A",
              color: "#D3DAD9",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center mt-6" style={{ color: "#D3DAD9", opacity: 0.6 }}>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="underline"
            style={{ color: "#D3DAD9" }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}