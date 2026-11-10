import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — DukaanSaathi AI" },
      { name: "description", content: "Set a new password for your DukaanSaathi account." },
      { property: "og:title", content: "Reset password — DukaanSaathi AI" },
      { property: "og:description", content: "Recover access to your private shop records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setRecovery(new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery");
  }, []);
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-3xl font-extrabold text-primary">DukaanSaathi AI</h1>
      <h2 className="mt-6 text-xl font-bold">Naya password</h2>
      {!recovery ? (
        <p className="mt-4">Email ka password reset link kholiye.</p>
      ) : done ? (
        <p className="mt-4 text-success">Password update ho gaya.</p>
      ) : (
        <form
          className="mt-4 grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== confirm) {
              setMessage("Dono passwords same hone chahiye.");
              return;
            }
            setBusy(true);
            const { error } = await supabase.auth.updateUser({ password });
            setBusy(false);
            if (error) setMessage("Password update nahi hua. Naya reset link mangaiye.");
            else setDone(true);
          }}
        >
          <label>
            Naya password
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border bg-card px-3"
            />
          </label>
          <label>
            Dobara password
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border bg-card px-3"
            />
          </label>
          {message && (
            <p role="alert" className="text-destructive">
              {message}
            </p>
          )}
          <Button disabled={busy}>{busy ? "Rukiye…" : "Password save karein"}</Button>
        </form>
      )}
      <Button asChild variant="link" className="mt-4">
        <Link to={done ? "/" : "/auth"}>{done ? "Dukaan kholiye" : "Sign in"}</Link>
      </Button>
    </main>
  );
}
