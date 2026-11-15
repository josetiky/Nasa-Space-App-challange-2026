import { createFileRoute, Link } from "@tanstack/react-router";
import MarsWalkWorkspace from "@/components/trek/marswalk/MarsWalkWorkspace";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "M.I.Y.H. — Mars In Your Hands" },
      {
        name: "description",
        content:
          "Mars In Your Hands (Space Rockstars): an interactive journey through Mars and its missions that ends with MarsWalk, a safe EVA route planner over real Gale crater terrain.",
      },
      { property: "og:title", content: "M.I.Y.H. — Mars In Your Hands" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <MarsWalkWorkspace
      initialTab="inicio"
      variantSwitch={
        <Link to="/trek" search={{ ui: "classic" }}>
          Consola clásica / Classic console →
        </Link>
      }
    />
  );
}
