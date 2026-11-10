import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { snapshotSchema } from "@/lib/shop";
import type { State } from "@/lib/store";

// Server-only shop bridge. Identity comes from Clerk (verified server-side via
// clerkMiddleware), mapped to a shop profile with clerk_profiles/ensure_shop_profile.
// Data access uses the *_for RPCs with the service-role client; never import this
// module's handler secrets in browser code — routes call these via useServerFn.

async function requireClerkUser(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required");
  return userId;
}

async function resolveProfileId(clerkId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: mapping, error: mapError } = await supabaseAdmin
    .from("clerk_profiles")
    .select("profile_id")
    .eq("clerk_id", clerkId)
    .maybeSingle();
  if (mapError) throw new Error("Shop profile resolve nahi hui. Dobara koshish kijiye.");
  if (mapping?.profile_id) return mapping.profile_id;
  let displayName = "";
  try {
    const { clerkClient } = await import("@clerk/tanstack-react-start/server");
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkId);
    displayName =
      clerkUser.fullName ||
      clerkUser.firstName ||
      clerkUser.primaryEmailAddress?.emailAddress ||
      "";
  } catch {
    // Display name is optional; the profile still gets created.
  }
  const { data: profileId, error } = await supabaseAdmin.rpc("ensure_shop_profile", {
    p_clerk_id: clerkId,
    p_display_name: displayName,
  });
  if (error || !profileId) throw new Error("Shop profile taiyaar nahi hui. Dobara koshish kijiye.");
  return profileId;
}

export const getShopData = createServerFn({ method: "GET" }).handler(async (): Promise<State> => {
  const profileId = await resolveProfileId(await requireClerkUser());
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("shop_snapshot_for", { p_user: profileId });
  if (error) throw new Error("Shop records load nahi hue. Dobara koshish kijiye.");
  return snapshotSchema.parse(data);
});

const writeInput = z.object({
  id: z.string().uuid(),
  transcript: z.string().max(1000),
  source: z.string().max(100),
  status: z.string().max(40),
  note: z.string().max(1000).default(""),
  expectedPrice: z.number().optional(),
  action: z.object({
    action: z.string(),
    product: z.string().nullish(),
    quantity: z.number().nullish(),
    unit: z.string().nullish(),
    customer: z.string().nullish(),
    amount: z.number().nullish(),
  }),
});

export const writeShopData = createServerFn({ method: "POST" })
  .inputValidator((input) => writeInput.parse(input))
  .handler(async ({ data }): Promise<string> => {
    const profileId = await resolveProfileId(await requireClerkUser());
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("shop_operation_for", {
      p_user: profileId,
      p_request: data.id,
      p_action: data.action.action,
      p_product: data.action.product ?? "",
      p_qty: data.action.quantity ?? 0,
      p_unit: data.action.unit ?? "",
      p_customer: data.action.customer ?? "",
      p_amount: data.action.amount ?? 0,
      p_transcript: data.transcript,
      p_source: data.source,
      p_status: data.status,
      p_note: data.note,
      ...(data.expectedPrice !== undefined ? { p_expected_price: data.expectedPrice } : {}),
    });
    if (error) {
      if (error.message.includes("insufficient"))
        throw new Error("Stock insufficient; bikri nahi likhi.");
      if (error.message.includes("Price changed"))
        throw new Error("Daam badal gaya. Records refresh karke dobara confirm kijiye.");
      throw new Error("Record save nahi hua. Dobara koshish kijiye; duplicate nahi banega.");
    }
    return result ?? "";
  });

const profileInput = z.object({
  display_name: z.string().max(100),
  shop_name: z.string().max(100),
});

export const getShopProfile = createServerFn({ method: "GET" }).handler(async () => {
  const profileId = await resolveProfileId(await requireClerkUser());
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("display_name,shop_name,avatar_url")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error("Profile load nahi hui.");
  return data ?? { display_name: "", shop_name: "", avatar_url: "" };
});

export const saveShopProfile = createServerFn({ method: "POST" })
  .inputValidator((input) => profileInput.parse(input))
  .handler(async ({ data }) => {
    const profileId = await resolveProfileId(await requireClerkUser());
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.display_name, shop_name: data.shop_name })
      .eq("id", profileId);
    if (error) throw new Error("Profile save nahi hui.");
    return { ok: true as const };
  });

export const getClerkMeta = createServerFn({ method: "GET" }).handler(() => {
  const publishableKey = process.env["CLERK_PUBLISHABLE_KEY"] ?? "";
  const authEnabled = Boolean(
    publishableKey &&
    process.env["CLERK_SECRET_KEY"] &&
    process.env["SUPABASE_URL"] &&
    process.env["SUPABASE_PUBLISHABLE_KEY"] &&
    process.env["SUPABASE_SERVICE_ROLE_KEY"] &&
    process.env["VITE_SUPABASE_URL"] &&
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
  );
  return {
    publishableKey: authEnabled ? publishableKey : "",
    authEnabled,
  };
});
