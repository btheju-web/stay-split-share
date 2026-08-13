import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  /** data URL: data:image/jpeg;base64,... */
  image: z.string().min(64).max(12_000_000),
});

export type ScannedItem = { name: string; amount: number };
export type ScanResult =
  | { ok: true; merchant: string | null; date: string | null; items: ScannedItem[]; total: number | null }
  | { ok: false; error: string };

export const scanReceipt = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<ScanResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "AI is not configured for this project." };

    if (!data.image.startsWith("data:image/")) {
      return { ok: false, error: "Please provide a photo of the receipt." };
    }

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You read receipts and return strict JSON. Amounts are numbers in the receipt currency (assume INR). Ignore taxes/discount lines only if they are already included in item prices; otherwise list them as items.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                'Extract the itemized costs from this receipt. Respond with JSON only, shape: {"merchant": string|null, "date": "YYYY-MM-DD"|null, "items": [{"name": string, "amount": number}], "total": number|null}. No markdown fences.',
            },
            { type: "image_url", image_url: { url: data.image } },
          ],
        },
      ],
    };

    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false, error: "Could not reach the scanner. Check your connection." };
    }

    if (res.status === 429) return { ok: false, error: "Too many scans right now. Try again shortly." };
    if (res.status === 402) return { ok: false, error: "AI credits exhausted for this project." };
    if (!res.ok) {
      console.error("[receipt] gateway error", res.status, await res.text().catch(() => ""));
      return { ok: false, error: "Could not read that receipt. Try a clearer photo." };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return { ok: false, error: "No items found on that receipt." };

    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
        merchant?: unknown;
        date?: unknown;
        total?: unknown;
        items?: { name?: unknown; amount?: unknown }[];
      };
      const items: ScannedItem[] = (parsed.items ?? [])
        .map((i) => ({
          name: String(i?.name ?? "").trim().slice(0, 80),
          amount: Number(i?.amount),
        }))
        .filter((i) => i.name.length > 0 && Number.isFinite(i.amount) && i.amount > 0);

      if (items.length === 0) return { ok: false, error: "No items found on that receipt." };

      return {
        ok: true,
        merchant: typeof parsed.merchant === "string" ? parsed.merchant.slice(0, 60) : null,
        date: typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
        items,
        total: Number.isFinite(Number(parsed.total)) ? Number(parsed.total) : null,
      };
    } catch {
      return { ok: false, error: "Could not read that receipt. Try a clearer photo." };
    }
  });
