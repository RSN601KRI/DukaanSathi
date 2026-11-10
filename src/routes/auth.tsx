import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useShopAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — DukaanSaathi AI" },
      { name: "description", content: "Sign in to your private DukaanSaathi shop records." },
      { property: "og:title", content: "Sign in — DukaanSaathi AI" },
      { property: "og:description", content: "Access your private stock, sales and udhaar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, accountAvailable } = useShopAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (user) void navigate({ to: "/", replace: true });
  }, [user, navigate]);
  async function submit() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (mode === "forgot") {
        const result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (result.error) throw result.error;
        setMessage("Agar account hai, password reset link email mein aayega.");
      } else if (mode === "signup") {
        const result = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (result.error) throw result.error;
        setMessage(
          result.data.session
            ? "Account taiyaar hai."
            : "Email mein confirmation link kholiye, phir sign in kijiye.",
        );
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in nahi hua. Dobara koshish kijiye.");
    } finally {
      setBusy(false);
    }
  }
  async function social(provider: "google" | "lovable") {
    setBusy(true);
    setError("");
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) setError("Sign in nahi hua. Dobara koshish kijiye.");
      if (result.redirected) return;
    } catch {
      setError("Sign in nahi hua. Dobara koshish kijiye.");
    } finally {
      setBusy(false);
    }
  }
  if (!accountAvailable) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-3xl font-extrabold text-primary">DukaanSaathi AI</h1>
        <h2 className="mt-6 text-xl font-bold">Local demo mode</h2>
        <p className="mt-3 text-muted-foreground">
          Sign-in ke liye Clerk aur Supabase credentials configure kijiye.
        </p>
        <Button asChild variant="link" className="mt-4">
          <Link to="/">← Demo par waapas</Link>
        </Button>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-3xl font-extrabold text-primary">DukaanSaathi AI</h1>
      <h2 className="mt-6 text-xl font-bold">
        {mode === "signup"
          ? "Naya account"
          : mode === "forgot"
            ? "Password bhool gaye?"
            : "Sign in"}
      </h2>
      <form
        className="mt-4 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label>
          Email
          <input
            aria-label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border bg-card px-3"
          />
        </label>
        {mode !== "forgot" && (
          <label>
            Password
            <input
              aria-label="Password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border bg-card px-3"
            />
          </label>
        )}
        {message && (
          <p role="status" className="text-success">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <Button size="lg" disabled={busy}>
          {busy
            ? "Rukiye…"
            : mode === "signup"
              ? "Account banaiye"
              : mode === "forgot"
                ? "Reset link bhejiye"
                : "Sign in"}
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="link"
          disabled={busy}
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError("");
            setMessage("");
          }}
        >
          {mode === "signup" ? "Sign in" : "Naya account"}
        </Button>
        <Button
          variant="link"
          disabled={busy}
          onClick={() => {
            setMode("forgot");
            setError("");
            setMessage("");
          }}
        >
          Password bhool gaye?
        </Button>
      </div>
      <div className="mt-5 grid gap-2">
        <Button variant="outline" size="lg" disabled={busy} onClick={() => social("google")}>
          Google se sign in
        </Button>
        <Button variant="outline" size="lg" disabled={busy} onClick={() => social("lovable")}>
          Sign in with Lovable
        </Button>
      </div>
      <Button asChild variant="link" className="mt-4">
        <Link to="/">← Demo par waapas</Link>
      </Button>
    </main>
  );
}
