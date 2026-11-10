import { createFileRoute, Link } from "@tanstack/react-router";
import { SignIn } from "@clerk/tanstack-react-start";
import { Mic } from "lucide-react";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { useShopAuth } from "@/components/auth-provider";

export const Route = createFileRoute("/signin/$")({
  head: () => ({
    meta: [
      { title: "Sign in — DukaanSaathi AI" },
      { name: "description", content: "Clerk se sign in karke apna private hisaab kholiye." },
      { property: "og:title", content: "Sign in — DukaanSaathi AI" },
      { property: "og:description", content: "Google ya email se sign in kijiye." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { accountAvailable } = useShopAuth();
  if (!accountAvailable) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-3xl font-extrabold text-primary">DukaanSaathi AI</h1>
        <p className="mt-4 text-muted-foreground">
          Sign-in ke liye Clerk aur Supabase credentials configure kijiye.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          ← Demo par waapas
        </Link>
      </main>
    );
  }
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-x-clip px-4 py-10">
      <Link
        to="/"
        className="mb-8 flex items-center gap-2 font-display text-2xl font-bold tracking-tight"
      >
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-lg">
          <Mic className="size-4" />
        </span>
        DukaanSaathi&nbsp;<span className="text-primary">AI</span>
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/40 p-2 shadow-2xl backdrop-blur">
        <SignIn signUpUrl="/signup" appearance={clerkAppearance} />
      </div>
      <Link
        to="/"
        className="mt-6 text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
      >
        ← Demo par waapas
      </Link>
    </main>
  );
}
