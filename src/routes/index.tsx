import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSplitStay } from "@/hooks/use-splitstay";
import { GroupSetup } from "@/components/splitstay/GroupSetup";
import { Dashboard } from "@/components/splitstay/Dashboard";

export const Route = createFileRoute("/")({
  // The app requires an account so data always syncs to the signed-in user.
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "SplitStay — Split expenses with your roommates" },
      {
        name: "description",
        content:
          "Track shared expenses and settle up with roommates or hostel mates. Sign in to keep every group in sync.",
      },
      { property: "og:title", content: "SplitStay — Split expenses with your roommates" },
      {
        property: "og:description",
        content:
          "Track shared expenses and settle up with roommates or hostel mates. Sign in to keep every group in sync.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const store = useSplitStay();

  if (!store.hydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!store.activeGroup) {
    return <GroupSetup store={store} />;
  }

  return <Dashboard store={store} />;
}
