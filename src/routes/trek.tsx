import { createFileRoute } from "@tanstack/react-router";
import { parseTrekUi, TrekVariantPage } from "@/components/trek/TrekVariantPage";

export const Route = createFileRoute("/trek")({
  ssr: false,
  validateSearch: parseTrekUi,
  component: TrekRoutePage,
});

function TrekRoutePage() {
  const { ui } = Route.useSearch();
  return <TrekVariantPage ui={ui ?? "marswalk"} path="/trek" />;
}
