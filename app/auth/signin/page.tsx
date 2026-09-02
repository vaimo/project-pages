"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";

const ENABLE_GOOGLE = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === "true" || process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN === "1";
import { useRouter, useSearchParams } from "next/navigation";

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
    const result = await signIn("credentials", { passphrase, redirect: false });
    setLoading(false);
    if (result?.error) setError("Incorrect passphrase. Please try again.");
    else router.push(callbackUrl);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        background: "var(--color-paper)",
      }}
    >
      {/* Left: editorial cover */}
      <aside
        style={{
          background: "var(--color-ink-90)",
          color: "var(--color-paper)",
          padding: "3rem 3.5rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
        className="signin-cover"
      >
        {/* Decorative rule */}
        <div style={{ position: "absolute", top: "50%", right: "-40%", width: "80%", height: "1px", background: "var(--color-accent)", opacity: 0.4, transform: "rotate(-8deg)" }} />
        <div style={{ position: "absolute", bottom: "12%", left: "-15%", width: "50%", height: "1px", background: "var(--color-rule)", opacity: 0.3 }} />

        <header style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Image
            src="/vaimo-logo-white.svg"
            alt="Vaimo"
            width={140}
            height={51}
            priority
            style={{ height: "36px", width: "auto", display: "block" }}
          />
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: "1px",
              height: "26px",
              background: "rgba(251, 247, 236, 0.28)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.7rem",
              fontWeight: 500,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "rgba(251, 247, 236, 0.55)",
            }}
          >
            Project Pages
          </span>
        </header>

        <div>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.7rem",
              fontWeight: 500,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
              margin: "0 0 1.25rem",
            }}
          >
            Volume 01 — Documentation
          </p>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontVariationSettings: '"opsz" 144, "SOFT" 30',
              fontWeight: 400,
              fontSize: "clamp(2.75rem, 5vw, 4.25rem)",
              lineHeight: 0.98,
              letterSpacing: "-0.028em",
              margin: 0,
              color: "var(--color-paper)",
            }}
          >
            A quiet<br />
            <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>reading</em>{" "}
            room<br />
            for the work.
          </h1>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontVariationSettings: '"opsz" 20',
              fontStyle: "italic",
              fontSize: "1.05rem",
              lineHeight: 1.5,
              color: "rgba(251, 247, 236, 0.7)",
              maxWidth: "26rem",
              margin: "2rem 0 0",
            }}
          >
            Specs, feature overviews, and per-repository technical slices — kept legible, kept together.
          </p>
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontFamily: "var(--font-mono)",
            fontSize: "0.7rem",
            color: "rgba(251, 247, 236, 0.35)",
            letterSpacing: "0.08em",
          }}
        >
          <span>Est. Vaimo</span>
          <span>—— § ——</span>
          <span>Internal Docs</span>
        </footer>
      </aside>

      {/* Right: form */}
      <main
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 2.5rem",
        }}
      >
        <div style={{ width: "100%", maxWidth: "24rem" }}>
          <p className="eyebrow" style={{ marginBottom: "0.65rem" }}>Access</p>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontVariationSettings: '"opsz" 96, "SOFT" 25',
              fontWeight: 400,
              fontSize: "2.25rem",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              margin: "0 0 0.5rem",
              color: "var(--color-ink-90)",
            }}
          >
            Enter the passphrase.
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.9375rem",
              lineHeight: 1.55,
              color: "var(--color-ink-40)",
              margin: "0 0 2rem",
            }}
          >
            Access is by shared secret. Ask your team lead if you don&apos;t have one.
          </p>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="passphrase"
              style={{
                display: "block",
                fontFamily: "var(--font-sans)",
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--color-ink-70)",
                marginBottom: "0.65rem",
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
                padding: "0.75rem 0",
                border: "none",
                borderBottom: `1px solid ${error ? "#c0392b" : "var(--color-ink-90)"}`,
                background: "transparent",
                fontFamily: "var(--font-mono)",
                fontSize: "1rem",
                letterSpacing: "0.15em",
                outline: "none",
                color: "var(--color-ink-90)",
              }}
            />

            {error && (
              <p style={{ color: "#c0392b", fontSize: "0.8125rem", margin: "0.75rem 0 0", fontFamily: "var(--font-sans)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "2rem",
                width: "100%",
                padding: "0.95rem",
                background: "var(--color-ink-90)",
                color: "var(--color-paper)",
                border: "none",
                borderRadius: "2px",
                fontFamily: "var(--font-sans)",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                transition: "opacity 0.15s, transform 0.15s",
              }}
            >
              {loading ? "Signing in…" : "Enter →"}
            </button>
          </form>

          {ENABLE_GOOGLE && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "2rem 0 1.5rem" }}>
                <div style={{ flex: 1, height: "1px", background: "var(--color-rule)" }} />
                <span className="eyebrow">or</span>
                <div style={{ flex: 1, height: "1px", background: "var(--color-rule)" }} />
              </div>
              <button
                onClick={() => signIn("google", { callbackUrl })}
                style={{
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.6rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "2px",
                  border: "1px solid var(--color-ink-90)",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  color: "var(--color-ink-90)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}
        </div>
      </main>

      <style jsx>{`
        @media (max-width: 780px) {
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr;
          }
          .signin-cover {
            padding: 2rem 1.5rem;
            min-height: 40vh;
          }
        }
      `}</style>
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
