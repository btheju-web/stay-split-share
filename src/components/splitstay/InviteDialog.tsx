import { useCallback, useEffect, useState } from "react";
import { Link2, Copy, Check, Mail, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useInviteSync } from "@/hooks/use-invite-sync";
import { createEmailInvite } from "@/lib/group-invites.functions";
import {
  fetchEmailInvites,
  fetchGroupMembers,
  removeGroupMember,
  revokeEmailInvite,
  type GroupMemberRow,
  type PendingInvite,
} from "@/lib/shared-groups";
import type { UseSplitStay } from "@/hooks/use-splitstay";

export function InviteDialog({ store }: { store: UseSplitStay }) {
  const group = store.activeGroup;
  const groupId = group?.id;
  const { inviteUrl, createInvite, creating, canInvite } = useInviteSync(store, groupId);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [linked, setLinked] = useState<GroupMemberRow[]>([]);

  const sharedId = group?.sharedId;
  const isOwner = !!sharedId && group?.ownerId === store.user?.id;

  const refresh = useCallback(async () => {
    if (!sharedId) {
      setInvites([]);
      setLinked([]);
      return;
    }
    const [inv, mem] = await Promise.all([fetchEmailInvites(sharedId), fetchGroupMembers(sharedId)]);
    setInvites(inv);
    setLinked(mem);
  }, [sharedId]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const linkFor = (token: string) =>
    typeof window === "undefined" ? "" : `${window.location.origin}/join/${token}`;

  const copy = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(message);
    setTimeout(() => setCopied(false), 1800);
  };

  const sendInvite = async () => {
    if (!group || !store.user) return;
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSending(true);
    try {
      const shared = group.sharedId ?? (await store.shareGroup(group.id));
      if (!shared) {
        toast.error("Could not set up the shared group. Try again.");
        return;
      }
      const res = await createEmailInvite({ data: { groupId: shared, email: address } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEmail("");
      await refresh();
      const url = linkFor(res.token);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success(
        res.reused ? "Invite already existed — link copied" : `Invite created for ${address} — link copied`,
      );
      window.open(
        `mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent(
          `Join "${group.name}" on SplitStay`,
        )}&body=${encodeURIComponent(
          `You're invited to split expenses in "${group.name}" on SplitStay.\n\nOpen this link and sign in with ${address}:\n${url}\n`,
        )}`,
        "_blank",
      );
    } catch {
      toast.error("Could not create the invite. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Invite members">
          <Link2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            Invite by email to link their account to {group?.name}, or share a quick name-only link.
          </DialogDescription>
        </DialogHeader>

        {!canInvite ? (
          <p className="text-sm text-muted-foreground">
            Sign in to invite people. Invites need an account so members can reach your group.
          </p>
        ) : (
          <Tabs defaultValue="email">
            <TabsList className="w-full">
              <TabsTrigger value="email" className="flex-1">
                By email
              </TabsTrigger>
              <TabsTrigger value="link" className="flex-1">
                Quick link
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4 pt-4">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="roommate@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void sendInvite()}
                />
                <Button onClick={() => void sendInvite()} disabled={sending}>
                  <Send className="h-4 w-4" />
                  {sending ? "Sending…" : "Invite"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                They must sign in with that exact email. Once they accept, their account is linked
                to this group and everyone shares the same expenses.
              </p>

              {linked.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Linked accounts</p>
                  {linked.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">
                        {m.displayName}
                        {m.role === "owner" && (
                          <span className="text-muted-foreground"> · owner</span>
                        )}
                      </span>
                      {isOwner && m.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${m.displayName}`}
                          onClick={async () => {
                            await removeGroupMember(m.id);
                            await refresh();
                            toast.success("Member removed");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {invites.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Invitations</p>
                  {invites.map((i) => (
                    <div key={i.id} className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{i.email}</span>
                      <span className="text-xs text-muted-foreground">
                        {i.acceptedAt ? "joined" : "pending"}
                      </span>
                      {!i.acceptedAt && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Copy invite link for ${i.email}`}
                            onClick={() => void copy(linkFor(i.token), "Invite link copied")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Revoke invite for ${i.email}`}
                            onClick={async () => {
                              await revokeEmailInvite(i.id);
                              await refresh();
                              toast.success("Invitation revoked");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="link" className="space-y-3 pt-4">
              {inviteUrl ? (
                <>
                  <div className="flex gap-2">
                    <Input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
                    <Button
                      onClick={() => void copy(inviteUrl, "Invite link copied")}
                      variant="secondary"
                      aria-label="Copy link"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Anyone with this link enters a name and is added to the member list — no account
                    needed. They won't see the group themselves.
                  </p>
                </>
              ) : (
                <Button
                  className="w-full"
                  disabled={creating}
                  onClick={async () => {
                    const t = await createInvite();
                    if (!t) toast.error("Could not create the link. Try again.");
                  }}
                >
                  {creating ? "Creating…" : "Create quick link"}
                </Button>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
