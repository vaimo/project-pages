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
              onClick={() => signIn("google")}
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
              <img src="/google-mark.svg" alt="Google" width={20} height={20} />
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
