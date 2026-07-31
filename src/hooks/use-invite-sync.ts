import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { UseSplitStay } from "@/hooks/use-splitstay";

/** Creates (or reuses) an invite link for a group and pulls in anyone who joined. */
export function useInviteSync(store: UseSplitStay, groupId: string | undefined) {
  const [token, setToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const addMember = store.addMember;
  const userId = store.user?.id;
  const membersKey = store.activeGroup?.members.map((m) => m.name.toLowerCase()).join("|") ?? "";
  const membersRef = useRef(membersKey);
  membersRef.current = membersKey;

  // Look up an existing invite for this group.
  useEffect(() => {
    if (!userId || !groupId) {
      setToken(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("group_invites")
        .select("token")
        .eq("owner_id", userId)
        .eq("group_id", groupId)
        .maybeSingle();
      if (!cancelled) setToken(data?.token ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, groupId]);

  const createInvite = useCallback(async () => {
    if (!userId || !groupId || !store.activeGroup) return null;
    setCreating(true);
    const newToken = crypto.randomUUID().replace(/-/g, "");
    const { data, error } = await supabase
      .from("group_invites")
      .insert({
        owner_id: userId,
        group_id: groupId,
        group_name: store.activeGroup.name,
        token: newToken,
      })
      .select("token")
      .maybeSingle();
    setCreating(false);
    if (error || !data) return null;
    setToken(data.token);
    return data.token;
  }, [userId, groupId, store.activeGroup]);

  // Poll for people who joined through the link and add them as members.
  useEffect(() => {
    if (!userId || !groupId) return;
    let cancelled = false;

    const pull = async () => {
      const { data: invites } = await supabase
        .from("group_invites")
        .select("id")
        .eq("owner_id", userId)
        .eq("group_id", groupId);
      if (!invites?.length || cancelled) return;

      const { data: joins } = await supabase
        .from("group_join_requests")
        .select("id, display_name")
        .in(
          "invite_id",
          invites.map((i) => i.id),
        )
        .eq("applied", false);
      if (!joins?.length || cancelled) return;

      const existing = new Set(membersRef.current.split("|").filter(Boolean));
      for (const j of joins) {
        const name = j.display_name.trim();
        if (name && !existing.has(name.toLowerCase())) {
          existing.add(name.toLowerCase());
          addMember(groupId, name);
        }
      }
      await supabase
        .from("group_join_requests")
        .update({ applied: true })
        .in(
          "id",
          joins.map((j) => j.id),
        );
    };

    void pull();
    const interval = setInterval(() => void pull(), 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId, groupId, addMember]);

  const inviteUrl =
    token && typeof window !== "undefined" ? `${window.location.origin}/join/${token}` : null;

  return { inviteUrl, createInvite, creating, canInvite: !!userId };
}
