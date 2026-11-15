/**
 * Tipografía de lectura (Atkinson Hyperlegible Next/Mono, Braille Institute · OFL) para la consola y
 * el aterrizaje. Se inyecta una sola vez; sin internet se usa Inter (ya incluida en /miyh/fonts).
 */
const ID = "miyh-atkinson";
const HREF =
  "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@400;600;700&family=Atkinson+Hyperlegible+Next:wght@400;500;700&display=swap";

export function ensureReadableFonts(): void {
  if (typeof document === "undefined" || document.getElementById(ID)) return;
  const link = document.createElement("link");
  link.id = ID;
  link.rel = "stylesheet";
  link.href = HREF;
  document.head.appendChild(link);
}
