import { Link, useLocation } from "@tanstack/react-router";
import {
  FlaskConical,
  Globe2,
  Home,
  Layers,
  Map as MapIcon,
  Menu,
  Moon,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { formatHours, marsTimeFromDate, seasonName } from "@/core/science/marsTime";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StatusPill } from "@/components/mission/ui";
import { MARS_MAPS, type MarsMapModule } from "@/data/marsMaps";
import { useMolaGrid, useRems } from "@/services/nasa/hooks";
import { useMission } from "@/state/missionStore";
import { cn } from "@/lib/utils";

const MAP_ICONS: Readonly<Record<MarsMapModule["to"], typeof Globe2>> = {
  "/explorer": Globe2,
  "/atlas": Layers,
  "/mission-lab": FlaskConical,
  "/hazard-layers": TriangleAlert,
  "/trek": MapIcon,
};

const FULL_BLEED = ["/explorer", "/atlas", "/mission-lab", "/trek", "/martian-map"];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const item = "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-fog transition hover:bg-ink2 hover:text-bright";
  const active = "bg-amber/10 text-bright ring-1 ring-amber/25";
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Mapas de Marte">
      <Link to="/" onClick={onNavigate} className={item} activeProps={{ className: active }} activeOptions={{ exact: true }}>
        <Home className="size-4 shrink-0 text-amber/80 group-hover:text-amber" />
        <span className="truncate">M.I.Y.H. · Inicio</span>
      </Link>
      <p className="px-3 pb-1.5 pt-4 font-mono text-[9px] uppercase tracking-[.22em] text-fog/80">Mapas de Marte</p>
      {MARS_MAPS.map(({ to, search, label }) => {
        const Icon = MAP_ICONS[to];
        return (
          <Link key={to} to={to} search={search ?? {}} onClick={onNavigate} className={item} activeProps={{ className: active }}>
            <Icon className="size-4 shrink-0 text-amber/80 group-hover:text-amber" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3 px-2">
      <div className="relative grid size-9 place-items-center rounded-xl border border-rose/30 bg-rose/10">
        <span className="beacon-dot size-2.5 rounded-full bg-rose" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-[13px] font-bold tracking-tight text-bright">M.I.Y.H.</p>
        <p className="font-mono text-[8.5px] uppercase tracking-[.2em] text-fog">Mars In Your Hands · Space Rockstars</p>
      </div>
    </Link>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("mars-theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <button type="button" onClick={toggle} className="theme-toggle inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-ink2/70 px-2.5 font-mono text-[10px] uppercase tracking-[.1em] text-fog transition hover:text-bright" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? <Sun className="size-3.5 text-amber" /> : <Moon className="size-3.5 text-cyan" />}
      {dark ? "Light" : "Dark"}
    </button>
  );
}

/** Real Mars time (Mars24 algorithm, Allison & McEwen 2000) — rendered after mount to avoid SSR mismatch. */
function MarsClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!now) return <span className="font-mono text-[11px] text-fog">Mars clock…</span>;
  const t = marsTimeFromDate(now);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-fog" title="Mars Sol Date, Coordinated Mars Time and solar longitude computed with the Mars24 algorithm">
      <span>
        <span className="text-fog/70">MY</span> <span className="text-bright">{t.marsYear}</span>
      </span>
      <span>
        <span className="text-fog/70">Ls</span> <span className="text-bright">{t.ls.toFixed(1)}°</span>
      </span>
      <span className="hidden sm:inline">
        <span className="text-fog/70">MSD</span> <span className="text-bright">{t.msd.toFixed(3)}</span>
      </span>
      <span>
        <span className="text-fog/70">MTC</span> <span className="text-bright">{formatHours(t.mtcHours)}</span>
      </span>
      <span className="hidden xl:inline text-fog/80">{seasonName(t.ls)} (N)</span>
    </span>
  );
}

function LinkDot({ label, state, detail }: { label: string; state: "ok" | "fallback" | "down" | "pending"; detail: string }) {
  const color = { ok: "bg-mint", fallback: "bg-amber", down: "bg-rose", pending: "bg-fog animate-pulse" }[state];
  return (
    <Link to="/nasa-data" className="flex items-center gap-1.5 rounded-full border border-line/70 px-2 py-0.5 font-mono text-[10px] text-fog hover:text-bright" title={`${label}: ${detail}`}>
      <span className={cn("size-1.5 rounded-full", color)} /> {label}
    </Link>
  );
}

function DataLinks() {
  const mola = useMolaGrid();
  const rems = useRems();
  const molaState = mola.isPending ? "pending" : mola.data ? "ok" : "down";
  const remsState = rems.isPending ? "pending" : rems.data ? (rems.data.origin === "snapshot" ? "fallback" : "ok") : "down";
  return (
    <div className="flex items-center gap-1.5">
      <LinkDot label="MOLA" state={molaState} detail={mola.data ? `grid loaded (${mola.data.origin})` : mola.error ? (mola.error as Error).message : "loading"} />
      <LinkDot label="REMS" state={remsState} detail={rems.data ? `weather feed (${rems.data.origin})` : rems.error ? (rems.error as Error).message : "loading"} />
    </div>
  );
}

function SimChip() {
  const sim = useMission((s) => s.sim);
  if (!sim) return null;
  return (
    <Link to={sim.status === "awaiting-decision" ? "/decisions" : "/simulator"} className="hidden items-center gap-2 md:flex">
      <StatusPill status={sim.status} />
      <span className="font-mono text-[10.5px] text-fog">
        Sol <span className="text-bright">{sim.sol}</span>/{sim.durationSols}
      </span>
    </Link>
  );
}

/** Rutas que son la experiencia principal (cubierta M.I.Y.H.): se muestran sin barra lateral ni encabezado. */
const DECK_ROUTES = ["/", "/martian-map"];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const fullBleed = FULL_BLEED.includes(location.pathname);
  if (DECK_ROUTES.includes(location.pathname)) return <>{children}</>;
  return (
    <div className="app-shell relative min-h-screen bg-ink text-bright lg:pl-60">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(90%_60%_at_80%_-10%,color-mix(in_srgb,var(--rose)_9%,transparent)_0%,transparent_55%)]" />
      <aside className="app-aside fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-panel/85 backdrop-blur-xl lg:flex">
        <div className="border-b border-line/70 px-3 py-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <NavList />
        </div>
        <div className="space-y-2 border-t border-line/70 p-3">
          <ThemeToggle />
          <p className="font-mono text-[9px] leading-relaxed text-fog/80">NASA Space Apps 2026 · Data: NASA/JPL-Caltech · Terrain: Access Mars (Google Creative Lab)</p>
        </div>
      </aside>

      <header className="app-header sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" className="grid size-9 place-items-center rounded-lg border border-line text-fog lg:hidden" aria-label="Open navigation">
                <Menu className="size-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-line bg-panel p-0 text-bright">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="border-b border-line/70 px-3 py-4">
                <Brand />
              </div>
              <div className="overflow-y-auto px-2 py-3">
                <NavList onNavigate={() => setOpen(false)} />
              </div>
              <div className="border-t border-line/70 p-3">
                <ThemeToggle />
              </div>
            </SheetContent>
          </Sheet>
          <div className="lg:hidden">
            <p className="font-display text-[12px] font-bold">M.I.Y.H.</p>
          </div>
          <div className="hidden min-w-0 flex-1 lg:block">
            <MarsClock />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <DataLinks />
          </div>
        </div>
      </header>

      <main className={cn("relative z-10", fullBleed ? "" : "mx-auto max-w-[1400px] px-4 py-6 sm:px-6")}>{children}</main>

      <footer className="app-footer relative z-10 border-t border-line bg-ink/60">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-6 py-4 font-mono text-[10px] leading-relaxed text-fog sm:flex-row sm:justify-between">
          <p>M.I.Y.H. — MARS IN YOUR HANDS · Space Rockstars · NASA Space Apps Challenge 2026</p>
          <p>
            Data: NASA/JPL-Caltech, USGS, GSFC (MOLA), CAB/CSIC-INTA (REMS), CNSA/GRAS · Surface terrain: Access Mars © Google Creative Lab (Apache-2.0). Models and simulations are labelled as such.
          </p>
        </div>
      </footer>
    </div>
  );
}
