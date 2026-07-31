import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(8).max(64) });
const joinSchema = z.object({
  token: z.string().min(8).max(64),
  name: z.string().trim().min(1).max(40),
});

export const getInviteInfo = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("group_invites")
      .select("id, group_name")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return { valid: false as const };
    return { valid: true as const, groupName: invite.group_name };
  });

export const joinViaInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => joinSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("group_invites")
      .select("id, group_name")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return { ok: false as const, error: "This invite link is no longer valid." };

    const { count } = await supabaseAdmin
      .from("group_join_requests")
      .select("id", { count: "exact", head: true })
      .eq("invite_id", invite.id);
    if ((count ?? 0) >= 100) {
      return { ok: false as const, error: "This invite has reached its limit." };
    }

    const { error } = await supabaseAdmin
      .from("group_join_requests")
      .insert({ invite_id: invite.id, display_name: data.name });
    if (error) return { ok: false as const, error: "Could not join right now. Try again." };

    return { ok: true as const, groupName: invite.group_name };
  });
