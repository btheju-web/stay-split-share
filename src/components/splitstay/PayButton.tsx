import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { IndianRupee, MessageCircle, Phone, Copy } from "lucide-react";
import { toast } from "sonner";
import { buildUpiLink, formatINR, normalizePhone, type Member } from "@/lib/splitstay";

type Props = { from: Member | undefined; to: Member | undefined; amount: number };

export function PayButton({ from, to, amount }: Props) {
  if (!to) return null;

  const note = from ? `SplitStay ${from.name}` : "SplitStay";
  const openUpi = (app: "upi" | "gpay" | "phonepe" | "paytm") => {
    if (!to.upi) return;
    window.location.href = buildUpiLink({ upi: to.upi, name: to.name, amount, note, app });
  };

  const remind = () => {
    if (!to.phone) return;
    const text = `Hi ${to.name}, settling up on SplitStay: ${formatINR(amount)}${
      to.upi ? ` to ${to.upi}` : ""
    }.`;
    window.open(
      `https://wa.me/${normalizePhone(to.phone)}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener",
    );
  };

  const hasAny = Boolean(to.upi || to.phone);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={to.upi ? "default" : "secondary"} className="h-8">
          <IndianRupee className="h-3.5 w-3.5" />
          Pay
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Pay {to.name} {formatINR(amount)}
        </DropdownMenuLabel>
        {to.upi ? (
          <>
            <DropdownMenuItem onClick={() => openUpi("upi")}>Any UPI app</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openUpi("gpay")}>Google Pay</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openUpi("phonepe")}>PhonePe</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openUpi("paytm")}>Paytm</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard.writeText(to.upi!);
                toast.success("UPI ID copied");
              }}
            >
              <Copy className="h-4 w-4" /> Copy UPI ID
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem disabled>No UPI ID saved</DropdownMenuItem>
        )}
        {to.phone && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={remind}>
              <MessageCircle className="h-4 w-4" /> Remind on WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`tel:${to.phone.replace(/\s/g, "")}`}>
                <Phone className="h-4 w-4" /> Call {to.name}
              </a>
            </DropdownMenuItem>
          </>
        )}
        {!hasAny && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Add payment details from the contacts icon in the header.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
