"use client";

import { useState,useEffect } from "react";
import { signIn,useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);  
  const { status } = useSession();
  
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

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

  if (status === "loading" || status === "authenticated") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#37353E" }}
      >
        <div className="animate-pulse" style={{ color: "#D3DAD9" }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#37353E" }}>

      <div
        className="hidden lg:flex lg:w-2/3 flex-col items-center justify-center p-12"
        style={{ backgroundColor: "#2D2B33" }}
      >
        <div className="max-w-md text-center">
        <h2
            className="text-3xl font-bold mb-2"
            style={{ color: "#D3DAD9" }}
          >
            Bouldy
          </h2>
          <p
            className="mb-8"
            style={{ color: "#D3DAD9", opacity: 0.6 }}
          >
            Your AI-powered knowledge companion
          </p>

          <Image
            src="/Bouldy.svg"
            alt="Bouldy"
            width={280}
            height={280}
            className="mx-auto"
          />
          <p
            className="text-l italic mt-5"
            style={{ color: "#D3DAD9", opacity: 0.8 }}
          >
            "I believe in you, I always have."
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/3 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Image
              src="/Bouldy.svg"
              alt="Bouldy Logo"
              width={80}
              height={80}
            />
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                className="p-3 rounded-lg text-sm"
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
                className="w-full px-4 py-3 rounded-lg outline-none transition-all focus:ring-2"
                style={{
                  backgroundColor: "#2D2B33",
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
                className="w-full px-4 py-3 rounded-lg outline-none transition-all focus:ring-2"
                style={{
                  backgroundColor: "#2D2B33",
                  color: "#D3DAD9",
                  border: "1px solid #715A5A",
                }}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-lg font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: "#715A5A",
                color: "#D3DAD9",
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-center mt-8" style={{ color: "#D3DAD9", opacity: 0.6 }}>
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="underline hover:opacity-80"
              style={{ color: "#D3DAD9" }}
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}