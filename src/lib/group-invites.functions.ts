import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const emailInviteSchema = z.object({
  groupId: z.string().uuid(),
  email: z.string().trim().email().max(160),
});
const tokenSchema = z.object({ token: z.string().min(16).max(64) });

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const shown = name.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

/** Owner-only: create an email-bound invite for a shared group. */
export const createEmailInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => emailInviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const email = data.email.toLowerCase();
    const { data: group } = await context.supabase
      .from("shared_groups")
      .select("id, name, owner_id")
      .eq("id", data.groupId)
      .maybeSingle();
    if (!group || group.owner_id !== context.userId) {
      return { ok: false as const, error: "Only the group owner can invite people." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("group_email_invites")
      .select("token, accepted_at")
      .eq("group_id", group.id)
      .eq("email", email)
      .maybeSingle();
    if (existing?.accepted_at) {
      return { ok: false as const, error: "That person has already joined this group." };
    }
    if (existing) {
      return { ok: true as const, token: existing.token, groupName: group.name, reused: true };
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabaseAdmin.from("group_email_invites").insert({
      group_id: group.id,
      email,
      token,
      invited_by: context.userId,
    });
    if (error) return { ok: false as const, error: "Could not create the invite. Try again." };
    return { ok: true as const, token, groupName: group.name, reused: false };
  });

/** Public: what an email invite link points at (email is masked). */
export const getEmailInvite = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("group_email_invites")
      .select("email, accepted_at, expires_at, shared_groups(name)")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return { kind: "none" as const };
    if (new Date(invite.expires_at) < new Date()) return { kind: "expired" as const };
    const group = invite.shared_groups as { name: string } | null;
    return {
      kind: "email" as const,
      groupName: group?.name ?? "a group",
      maskedEmail: maskEmail(invite.email),
      accepted: !!invite.accepted_at,
    };
  });

/** Signed-in: accept an email invite whose address matches the account. */
export const acceptEmailInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("group_email_invites")
      .select("id, group_id, email, expires_at, shared_groups(name)")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return { ok: false as const, error: "This invite link is no longer valid." };
    if (new Date(invite.expires_at) < new Date()) {
      return { ok: false as const, error: "This invite link has expired." };
    }

    const claims = context.claims as { email?: string } | null;
    const userEmail = (claims?.email ?? "").toLowerCase();
    if (!userEmail || userEmail !== invite.email.toLowerCase()) {
      return {
        ok: false as const,
        error: `This invite is for ${invite.email}. Sign in with that email to join.`,
      };
    }

    const displayName = userEmail.split("@")[0];
    const { error } = await supabaseAdmin.from("group_members").upsert(
      {
        group_id: invite.group_id,
        user_id: context.userId,
        display_name: displayName,
        role: "member",
      },
      { onConflict: "group_id,user_id" },
    );
    if (error) return { ok: false as const, error: "Could not join the group. Try again." };

    await supabaseAdmin
      .from("group_email_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    const group = invite.shared_groups as { name: string } | null;
    return { ok: true as const, groupName: group?.name ?? "the group", displayName };
  });
