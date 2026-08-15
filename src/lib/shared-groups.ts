import { supabase } from "@/integrations/supabase/client";
import type { Group } from "@/lib/splitstay";
import { normalizeState } from "@/lib/splitstay";

/** The part of a group that lives in the shared record. */
export type SharedGroupState = Pick<Group, "members" | "expenses" | "payments" | "budgets">;

export type SharedGroupRow = {
  id: string;
  name: string;
  ownerId: string;
  updatedAt: string;
  state: SharedGroupState;
};

function toState(raw: unknown): SharedGroupState {
  const g = (raw ?? {}) as Partial<SharedGroupState>;
  return {
    members: g.members ?? [],
    expenses: g.expenses ?? [],
    payments: g.payments ?? [],
    budgets: g.budgets ?? {},
  };
}

/** Every shared group the signed-in user belongs to (owned or joined). */
export async function fetchSharedGroups(): Promise<SharedGroupRow[]> {
  const { data, error } = await supabase
    .from("shared_groups")
    .select("id, name, owner_id, updated_at, state");
  if (error) {
    console.error("[splitstay] shared groups load failed", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    ownerId: r.owner_id,
    updatedAt: r.updated_at,
    state: toState(r.state),
  }));
}

/** Turns a local group into a shared one owned by the current user. */
export async function publishGroup(
  userId: string,
  group: Group,
  displayName: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("shared_groups")
    .insert({
      owner_id: userId,
      name: group.name,
      state: {
        members: group.members,
        expenses: group.expenses,
        payments: group.payments ?? [],
        budgets: group.budgets ?? {},
      },
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("[splitstay] publish failed", error);
    return null;
  }
  const { error: memberError } = await supabase.from("group_members").insert({
    group_id: data.id,
    user_id: userId,
    display_name: displayName,
    role: "owner",
  });
  if (memberError) console.error("[splitstay] owner membership failed", memberError);
  return data.id;
}

export async function saveSharedGroup(group: Group) {
  if (!group.sharedId) return;
  const { error } = await supabase
    .from("shared_groups")
    .update({
      name: group.name,
      state: {
        members: group.members,
        expenses: group.expenses,
        payments: group.payments ?? [],
        budgets: group.budgets ?? {},
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", group.sharedId);
  if (error) console.error("[splitstay] shared save failed", error);
}

/** Merges the remote shared groups into a local state's group list. */
export function mergeShared(groups: Group[], rows: SharedGroupRow[]): Group[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const merged: Group[] = [];
  for (const g of groups) {
    const row = g.sharedId ? byId.get(g.sharedId) : undefined;
    if (g.sharedId && !row) continue; // removed from the group remotely
    if (row) {
      byId.delete(row.id);
      merged.push({
        ...g,
        id: row.id,
        sharedId: row.id,
        ownerId: row.ownerId,
        name: row.name,
        ...row.state,
      });
    } else {
      merged.push(g);
    }
  }
  for (const row of byId.values()) {
    merged.push({
      id: row.id,
      sharedId: row.id,
      ownerId: row.ownerId,
      name: row.name,
      createdAt: row.updatedAt,
      ...row.state,
    });
  }
  return normalizeState({ groups: merged, activeGroupId: null }).groups;
}

export type GroupMemberRow = {
  id: string;
  userId: string;
  displayName: string;
  role: string;
};

export async function fetchGroupMembers(sharedId: string): Promise<GroupMemberRow[]> {
  const { data } = await supabase
    .from("group_members")
    .select("id, user_id, display_name, role")
    .eq("group_id", sharedId);
  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    displayName: r.display_name,
    role: r.role,
  }));
}

export type PendingInvite = { id: string; email: string; token: string; acceptedAt: string | null };

export async function fetchEmailInvites(sharedId: string): Promise<PendingInvite[]> {
  const { data } = await supabase
    .from("group_email_invites")
    .select("id, email, token, accepted_at")
    .eq("group_id", sharedId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    token: r.token,
    acceptedAt: r.accepted_at,
  }));
}

export async function revokeEmailInvite(id: string) {
  await supabase.from("group_email_invites").delete().eq("id", id);
}

export async function removeGroupMember(id: string) {
  await supabase.from("group_members").delete().eq("id", id);
}
