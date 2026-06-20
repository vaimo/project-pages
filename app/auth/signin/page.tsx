"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";

const ENABLE_GOOGLE = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === "true" || process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === "1";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

function SignInForm() {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  async function handleSubmit(e: React.FormEvent) {

    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      passphrase,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Incorrect passphrase. Please try again.");
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-grey-100)",
      }}
    >
      <div
        style={{
          background: "var(--color-white)",
          border: "1px solid var(--color-grey-300)",
          borderRadius: "8px",
          padding: "2.5rem",
          width: "100%",
          maxWidth: "380px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <Image
            src="/vaimo-logo.webp"
            alt="Vaimo"
            width={120}
            height={40}
            style={{ display: "inline-block" }}
          />
          <p
            style={{
              marginTop: "1rem",
              color: "var(--color-grey-700)",
              fontSize: "0.9375rem",
            }}
          >
            Enter the passphrase to access this space.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="passphrase"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: 600,
                marginBottom: "0.4rem",
                color: "var(--color-grey-700)",
              }}
            >
              Passphrase
            </label>
            <input
              id="passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
              autoFocus
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                border: `1px solid ${error ? "#c0392b" : "var(--color-grey-300)"}`,
                borderRadius: "4px",
                fontSize: "1rem",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-yellow)")}
              onBlur={(e) =>
                (e.target.style.borderColor = error ? "#c0392b" : "var(--color-grey-300)")
              }
            />
          </div>

          {error && (
            <p
              style={{
                color: "#c0392b",
                fontSize: "0.875rem",
                marginBottom: "1rem",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.7rem",
              background: "var(--color-yellow)",
              color: "var(--color-grey-900)",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {ENABLE_GOOGLE && (
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button
              onClick={() => signIn("google", { callbackUrl })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1rem",
                borderRadius: "4px",
                border: "1px solid var(--color-grey-300)",
                background: "var(--color-white)",
                cursor: "pointer",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span style={{ fontWeight: 600 }}>Sign in with Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
