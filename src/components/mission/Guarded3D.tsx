import { Component, type ReactNode, useEffect, useState } from "react";

/** True when the browser can create a WebGL context (some devices, policies and bots disable it). */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn("3D view disabled:", error);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function NoWebGL({ what }: { what: string }) {
  return (
    <div className="grid h-full min-h-[200px] w-full place-items-center bg-black/60 p-6 text-center">
      <div className="max-w-sm">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-amber">3D view unavailable</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-fog">
          {what} needs WebGL, which this browser or device has turned off. Everything else on the page works; for the 3D
          view, use a browser with hardware acceleration enabled.
        </p>
      </div>
    </div>
  );
}

/**
 * Renders 3D content only where WebGL works. Without it, or if the renderer throws, a short notice
 * replaces just this view instead of the whole page falling into the route's error screen.
 */
export function Guarded3D({ what, children }: { what: string; children: ReactNode }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => setSupported(webglAvailable()), []);
  if (supported === null) return null;
  const fallback = <NoWebGL what={what} />;
  return supported ? <Boundary fallback={fallback}>{children}</Boundary> : fallback;
}
