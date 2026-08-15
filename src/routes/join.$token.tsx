import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Users, Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInviteInfo, joinViaInvite } from "@/lib/invites.functions";
import { acceptEmailInvite, getEmailInvite } from "@/lib/group-invites.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/join/$token")({
  head: () => ({
    meta: [
      { title: "Join a group on SplitStay" },
      {
        name: "description",
        content: "You've been invited to split expenses with a group on SplitStay.",
      },
      { property: "og:title", content: "Join a group on SplitStay" },
      {
        property: "og:description",
        content: "You've been invited to split expenses with a group on SplitStay.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

type Status = "loading" | "ready" | "invalid" | "expired" | "joined" | "email" | "signin";

function JoinPage() {
  const { token } = useParams({ from: "/join/$token" });
  const { user, loading: authLoading } = useAuth();
  const [groupName, setGroupName] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void (async () => {
      try {
        const email = await getEmailInvite({ data: { token } });
        if (cancelled) return;
        if (email.kind === "expired") {
          setStatus("expired");
          return;
        }
        if (email.kind === "email") {
          setGroupName(email.groupName);
          setMaskedEmail(email.maskedEmail);
          setStatus(user ? "email" : "signin");
          return;
        }
        const res = await getInviteInfo({ data: { token } });
        if (cancelled) return;
        if (res.valid) {
          setGroupName(res.groupName);
          setStatus("ready");
        } else {
          setStatus("invalid");
        }
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user, authLoading]);

  const join = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await joinViaInvite({ data: { token, name: name.trim() } });
      if (res.ok) setStatus("joined");
      else setError(res.error);
    } catch {
      setError("Something went wrong. Try again.");
    }
    setSubmitting(false);
  };

  const accept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await acceptEmailInvite({ data: { token } });
      if (res.ok) {
        setGroupName(res.groupName);
        setStatus("joined");
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Try again.");
    }
    setSubmitting(false);
  };

  const heading =
    status === "invalid"
      ? "Invite not found"
      : status === "expired"
        ? "Invite expired"
        : status === "joined"
          ? "You're in!"
          : groupName
            ? `Join ${groupName}`
            : "Loading invite…";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <Users className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          {status === "loading" && (
            <p className="text-sm text-muted-foreground text-center">Checking your invite…</p>
          )}

          {(status === "invalid" || status === "expired") && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {status === "expired"
                  ? "This invite link has expired. Ask for a fresh one."
                  : "This invite link is invalid or has been removed. Ask for a fresh link."}
              </p>
              <Button asChild variant="secondary" className="w-full">
                <Link to="/">Go to SplitStay</Link>
              </Button>
            </div>
          )}

          {status === "signin" && (
            <div className="space-y-4 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <Mail className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                This invite is for{" "}
                <span className="font-medium text-foreground">{maskedEmail}</span>. Sign in with
                that email to join <span className="font-medium text-foreground">{groupName}</span>{" "}
                and share its expenses.
              </p>
              <Button asChild className="w-full h-11">
                <Link to="/auth" search={{ redirect: `/join/${token}` }}>
                  Sign in to join
                </Link>
              </Button>
            </div>
          )}

          {status === "email" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You're invited to <span className="font-medium text-foreground">{groupName}</span>{" "}
                as <span className="font-medium text-foreground">{maskedEmail}</span>. Joining links
                your account to the group's shared expenses.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full h-11" disabled={submitting} onClick={() => void accept()}>
                {submitting ? "Joining…" : `Join ${groupName ?? "group"}`}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Signed in as {user?.email}
              </p>
            </div>
          )}

          {status === "ready" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-name">Your name</Label>
                <Input
                  id="join-name"
                  placeholder="e.g. Priya"
                  value={name}
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void join();
                  }}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full h-11"
                disabled={!name.trim() || submitting}
                onClick={() => void join()}
              >
                {submitting ? "Joining…" : `Join ${groupName ?? "group"}`}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                You'll be added as a member so expenses can be split with you.
              </p>
            </div>
          )}

          {status === "joined" && (
            <div className="space-y-4 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <Check className="h-6 w-6 text-[color:var(--success)]" />
              </div>
              <p className="text-sm text-muted-foreground">
                You've been added to <span className="font-medium text-foreground">{groupName}</span>
                .
              </p>
              <Button asChild variant="secondary" className="w-full">
                <Link to="/">Open SplitStay</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
