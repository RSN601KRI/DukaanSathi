import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { clerkMiddleware } from "@clerk/tanstack-react-start/server";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const clerkConfigured = Boolean(
  process.env["CLERK_SECRET_KEY"] && process.env["CLERK_PUBLISHABLE_KEY"],
);
const supabaseConfigured = Boolean(
  process.env["VITE_SUPABASE_URL"] && process.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
);

export const startInstance = createStart(() => ({
  functionMiddleware: supabaseConfigured ? [attachSupabaseAuth] : [],
  requestMiddleware: [
    ...(clerkConfigured ? [clerkMiddleware()] : []),
    errorMiddleware,
    csrfMiddleware,
  ],
}));
