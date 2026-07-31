import { useState } from "react";
import { Link2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useInviteSync } from "@/hooks/use-invite-sync";
import type { UseSplitStay } from "@/hooks/use-splitstay";

export function InviteDialog({ store }: { store: UseSplitStay }) {
  const groupId = store.activeGroup?.id;
  const { inviteUrl, createInvite, creating, canInvite } = useInviteSync(store, groupId);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Invite members">
          <Link2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite by link</DialogTitle>
          <DialogDescription>
            Share this link — whoever opens it enters their name and is added to{" "}
            {store.activeGroup?.name} automatically.
          </DialogDescription>
        </DialogHeader>

        {!canInvite ? (
          <p className="text-sm text-muted-foreground">
            Sign in to create an invite link. Invite links need an account so new members can
            reach your group.
          </p>
        ) : inviteUrl ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={copy} variant="secondary" aria-label="Copy link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              New members show up here within a few seconds of joining.
            </p>
          </div>
        ) : (
          <Button
            className="w-full"
            disabled={creating}
            onClick={async () => {
              const t = await createInvite();
              if (!t) toast.error("Could not create the link. Try again.");
            }}
          >
            {creating ? "Creating…" : "Create invite link"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
