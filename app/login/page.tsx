"use client";

import { getProviders, signIn } from "next-auth/react";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [ready, setReady] = useState(false);
  const [hasGitHub, setHasGitHub] = useState(false);

  useEffect(() => {
    getProviders().then((providers) => {
      setHasGitHub(Boolean(providers?.github));
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-card">
        <a className="admin-auth-brand" href="/">THE POSITIVE PRESS <span>GLOBAL</span></a>
        <p className="admin-auth-kicker">PRIVATE EDITORIAL WORKSPACE</p>
        <h1>Welcome to the newsroom.</h1>
        <p className="admin-auth-copy">Sign in with the authorised GitHub account to access editorial tools. Public registration is disabled.</p>
        <button className="github-signin" disabled={!ready || !hasGitHub} onClick={() => signIn("github", { callbackUrl: "/admin" })}>
          <span aria-hidden="true">⌘</span> {ready ? (hasGitHub ? "Continue with GitHub" : "GitHub sign-in not configured") : "Checking sign-in…"}
        </button>
        <a className="admin-auth-back" href="/">← Back to the publication</a>
      </section>
    </main>
  );
}
