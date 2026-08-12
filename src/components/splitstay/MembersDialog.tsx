import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Contact, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { UseSplitStay } from "@/hooks/use-splitstay";
import { isValidPhone, isValidUpiId } from "@/lib/splitstay";

export function MembersDialog({ store }: { store: UseSplitStay }) {
  const group = store.activeGroup!;
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [draft, setDraft] = useState<Record<string, { phone: string; upi: string }>>({});

  useEffect(() => {
    if (!open) return;
    const d: Record<string, { phone: string; upi: string }> = {};
    group.members.forEach((m) => {
      d[m.id] = { phone: m.phone ?? "", upi: m.upi ?? "" };
    });
    setDraft(d);
  }, [open, group.members]);

  const save = () => {
    for (const m of group.members) {
      const v = draft[m.id];
      if (!v) continue;
      const phone = v.phone.trim();
      const upi = v.upi.trim();
      if (phone && !isValidPhone(phone)) {
        toast.error(`Invalid phone number for ${m.name}`);
        return;
      }
      if (upi && !isValidUpiId(upi)) {
        toast.error(`Invalid UPI ID for ${m.name} (e.g. name@okhdfcbank)`);
        return;
      }
    }
    for (const m of group.members) {
      const v = draft[m.id];
      if (!v) continue;
      store.updateMember(group.id, m.id, {
        phone: v.phone.trim() || undefined,
        upi: v.upi.trim() || undefined,
      });
    }
    toast.success("Member details saved");
    setOpen(false);
  };

  const add = () => {
    const n = newName.trim();
    if (!n) return;
    store.addMember(group.id, n);
    setNewName("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Manage members">
          <Contact className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Members & payment details</DialogTitle>
          <DialogDescription>
            Add a UPI ID to enable one-tap payments, and a phone number for calls or WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {group.members.map((m) => (
            <div key={m.id} className="rounded-xl border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{m.name}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => store.removeMember(group.id, m.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`upi-${m.id}`} className="text-xs">
                    UPI ID
                  </Label>
                  <Input
                    id={`upi-${m.id}`}
                    placeholder="name@okaxis"
                    value={draft[m.id]?.upi ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [m.id]: { phone: d[m.id]?.phone ?? "", upi: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`ph-${m.id}`} className="text-xs">
                    Phone
                  </Label>
                  <Input
                    id={`ph-${m.id}`}
                    inputMode="tel"
                    placeholder="98765 43210"
                    value={draft[m.id]?.phone ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [m.id]: { upi: d[m.id]?.upi ?? "", phone: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="newmember" className="text-xs">
              Add member
            </Label>
            <div className="flex gap-2">
              <Input
                id="newmember"
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <Button variant="secondary" onClick={add}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button className="w-full" onClick={save}>
            Save details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
