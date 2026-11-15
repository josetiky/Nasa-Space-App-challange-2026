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
      {
        property: "og:description",
        content:
          "A map for the first walk on Mars: safe EVA routes over real Gale crater terrain, astronaut health monitoring and a 3D topographic simulator. NASA Space Apps Challenge · Space Rockstars.",
      },
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
