import { parseIconRef, parseSize, themeVar } from "./icons";
import { insideCode, type LineSource } from "./code-context";

// {{icon:name}}, {{icon:devicon/proxmox}}, {{icon:lucide:folder}},
// {{icon:name|24}}, {{icon:name|1.5em}}, {{icon:name|red}},
// {{icon:name|24|blue}}, {{icon:name|dark:simple/docker}}.
// Zweiter und dritter Teil in beliebiger Reihenfolge: Größe, Farbe
// oder dunkle Variante. Emoji geht nur im Explorer Mapping.
export const ICON_TAG_RE =
  /\{\{icon:([A-Za-z0-9_\-/:.]+?)(?:\.svg)?(?:\|([^{}|]*))?(?:\|([^{}|]*))?(?:\|([^{}|]*))?\}\}/g;

export function parseTagParams(
  first: string | undefined,
  second: string | undefined,
  third: string | undefined,
): { size?: string; color?: string; darkIcon?: string } {
  let size: string | undefined;
  let color: string | undefined;
  let darkIcon: string | undefined;
  for (const raw of [first, second, third]) {
    const param = (raw ?? "").trim();
    if (!param) continue;
    if (param.startsWith("dark:")) {
      const ref = parseIconRef(param.slice("dark:".length));
      if (ref && !darkIcon) darkIcon = param.slice("dark:".length).trim();
      continue;
    }
    if (!size) {
      const parsed = parseSize(param);
      if (parsed) {
        size = parsed;
        continue;
      }
    }
    if (!color && themeVar(param)) {
      color = param;
    }
  }
  return { size, color, darkIcon };
}

/** SVG Referenzen in einem Text, dunkle Variante inklusive. */
export function refsInText(text: string): string[] {
  const refs: string[] = [];
  if (!text.includes("{{icon:")) return refs;
  const source = textSource(text);
  const re = new RegExp(ICON_TAG_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    // Code bleibt Text, wie im Renderer: Beispiele in Backticks sind keine Icons.
    if (insideCode(source, match.index)) continue;
    const ref = parseIconRef(match[1] ?? "");
    if (ref?.kind === "svg") refs.push(ref.name);
    const { darkIcon } = parseTagParams(match[2], match[3], match[4]);
    const dark = darkIcon ? parseIconRef(darkIcon) : null;
    if (dark?.kind === "svg") refs.push(dark.name);
  }
  return refs;
}

/** Text als LineSource, damit insideCode dieselben Regeln wie im Editor nutzt. */
function textSource(text: string): LineSource {
  const lines = text.split("\n");
  const starts: number[] = [];
  let at = 0;
  for (const line of lines) {
    starts.push(at);
    at += line.length + 1;
  }
  let index = 0;
  return {
    line: (n) => ({ number: n, text: lines[n - 1] ?? "" }),
    // Treffer laufen aufsteigend, deshalb reicht ein Zeiger.
    lineAt: (pos) => {
      while (index + 1 < lines.length && (starts[index + 1] ?? 0) <= pos) {
        index++;
      }
      return {
        number: index + 1,
        from: starts[index] ?? 0,
        text: lines[index] ?? "",
      };
    },
  };
}
