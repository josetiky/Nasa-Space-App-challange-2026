import { createFileRoute } from "@tanstack/react-router";
import { parseTrekUi, TrekVariantPage } from "@/components/trek/TrekVariantPage";

export const Route = createFileRoute("/martian-map")({
  ssr: false,
  validateSearch: parseTrekUi,
  component: MartianMapRoutePage,
});

function MartianMapRoutePage() {
  const { ui } = Route.useSearch();
  return <TrekVariantPage ui={ui ?? "marswalk"} path="/martian-map" />;
}
