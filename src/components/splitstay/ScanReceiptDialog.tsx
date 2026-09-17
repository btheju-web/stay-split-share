import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scanReceipt } from "@/lib/receipt.functions";
import { formatINR } from "@/lib/splitstay";
import type { UseSplitStay } from "@/hooks/use-splitstay";

type Row = { id: string; name: string; amount: string; split: string[] };

/** Downscale + JPEG-compress so the upload stays small. */
async function toCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function ScanReceiptDialog({ store }: { store: UseSplitStay }) {
  const group = store.activeGroup!;
  const scan = useServerFn(scanReceipt);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidBy, setPaidBy] = useState(group.members[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setPreview(null);
    setMerchant("");
    setDate(new Date().toISOString().slice(0, 10));
    setPaidBy(group.members[0]?.id ?? "");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const image = await toCompressedDataUrl(file);
      setPreview(image);
      const res = await scan({ data: { image } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setMerchant(res.merchant ?? "");
      if (res.date) setDate(res.date);
      setRows(
        res.items.map((i, idx) => ({
          id: `${idx}-${i.name}`,
          name: i.name,
          amount: i.amount.toFixed(2),
          split: group.members.map((m) => m.id),
        })),
      );
      toast.success(`Found ${res.items.length} item${res.items.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Could not read that image.");
    } finally {
      setBusy(false);
    }
  };

  const total = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const valid =
    rows.length > 0 &&
    paidBy &&
    rows.every((r) => r.name.trim() && parseFloat(r.amount) > 0 && r.split.length > 0);

  const save = () => {
    if (!valid) return;
    store.addExpenses(
      group.id,
      rows.map((r) => ({
        description: merchant.trim() ? `${merchant.trim()} · ${r.name.trim()}` : r.name.trim(),
        amount: parseFloat(r.amount),
        paidBy,
        splitBetween: r.split,
        date: new Date(date).toISOString(),
      })),
    );
    toast.success(`Added ${rows.length} expenses from the receipt`);
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Scan receipt">
          <Camera className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scan a receipt</DialogTitle>
        </DialogHeader>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => cameraRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Take photo
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>

        {preview && (
          <img
            src={preview}
            alt="Receipt preview"
            className="rounded-xl max-h-40 w-full object-cover"
          />
        )}

        {busy && (
          <p className="text-sm text-muted-foreground text-center">Reading the receipt…</p>
        )}

        {rows.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant</Label>
                <Input
                  id="merchant"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rdate">Date</Label>
                <Input
                  id="rdate"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Paid by</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {group.members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Items · split each between</Label>
              {rows.map((r, i) => (
                <div key={r.id} className="rounded-xl border p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={r.name}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)),
                        )
                      }
                    />
                    <MoneyInput
                      className="w-24"
                      value={r.amount}
                      onValueChange={(v) =>
                        setRows((rs) => rs.map((x, xi) => (xi === i ? { ...x, amount: v } : x)))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove item"
                      onClick={() => setRows((rs) => rs.filter((_, xi) => xi !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {group.members.map((m) => (
                      <label key={m.id} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={r.split.includes(m.id)}
                          onCheckedChange={(v) =>
                            setRows((rs) =>
                              rs.map((x, xi) =>
                                xi === i
                                  ? {
                                      ...x,
                                      split: v
                                        ? [...x.split, m.id]
                                        : x.split.filter((s) => s !== m.id),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                        {m.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Receipt total: {formatINR(total)} · {rows.length} expenses will be added
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            Add expenses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
