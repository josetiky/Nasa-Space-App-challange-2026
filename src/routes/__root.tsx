import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { AppShell } from "../components/shell/AppShell";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-bright">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-bright">Signal lost</h2>
        <p className="mt-2 font-mono text-sm text-fog">
          The waypoint you're looking for is outside the survey grid.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-amber px-4 py-2 font-display text-sm font-semibold text-ink transition-colors hover:bg-amber/90"
          >
            Return to console
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error instanceof Error ? error : new Error(String(error)), { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-bright">
          Telemetry interrupted
        </h1>
        <p className="mt-2 font-mono text-sm text-fog">
          Something failed on our end. You can retry or head back to the console.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-amber px-4 py-2 font-display text-sm font-semibold text-ink transition-colors hover:bg-amber/90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-line bg-panel/40 px-4 py-2 font-display text-sm text-fog transition-colors hover:text-bright"
          >
            Return to console
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Mars // Survive" },
      { name: "theme-color", content: "#0d0b0a" },
      { title: "MARS // SURVIVE — Intelligent Mission Control" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Dark mission-control theme by default; honour an explicit light choice before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('mars-theme')==='light')document.documentElement.classList.remove('dark')}catch(e){}" }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <Outlet />
      </AppShell>
    </QueryClientProvider>
  );
}
