import { createFileRoute } from "@tanstack/react-router";
import { useSplitStay } from "@/hooks/use-splitstay";
import { GroupSetup } from "@/components/splitstay/GroupSetup";
import { Dashboard } from "@/components/splitstay/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SplitStay — Split expenses with your roommates" },
      {
        name: "description",
        content:
          "Track shared expenses and settle up with roommates or hostel mates. Simple, mobile-friendly, no login required.",
      },
      { property: "og:title", content: "SplitStay — Split expenses with your roommates" },
      {
        property: "og:description",
        content:
          "Track shared expenses and settle up with the fewest transactions. In ₹, in your browser.",
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
