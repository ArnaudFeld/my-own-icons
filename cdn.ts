import { requestUrl } from "obsidian";
import { DEVICON_NAMES, DEVICON_TAGS } from "./cdn-catalog";
import {
  SELFHOST_CATALOG,
  SELFHOST_DATE,
  SelfhostEntry,
} from "./selfhost-catalog";
import { sanitizeSvg } from "./icons";

export { DEVICON_NAMES, DEVICON_TAGS, SELFHOST_DATE };
export type { SelfhostEntry };

/** Simple Icons via CDN, kuratierte Homelab Marken wie im Starter Set. */
export const SIMPLE_CDN_SLUGS: string[] = [
  "homeassistant",
  "homebridge",
  "pihole",
  "truenas",
  "nextcloud",
  "jellyfin",
  "traefikproxy",
  "esphome",
  "unraid",
  "opnsense",
];

/** Laufzeit Verkehr läuft über die Hauptzweige, Starter Dateien bleiben gepinnt.
 * Simple Icons hat keinen main Zweig, dort gilt develop. */
const DEVICON_BRANCH = "master";
const SIMPLE_BRANCH = "develop";
const SELFHOST_BRANCH = "main";

const DEVICON_VARIANTS = ["plain", "original", "line"];
const MAX_ENTRIES = 150;
const MAX_BYTES = 1500000;
/** Einzelnes CDN Icon über dieser Größe wird verworfen, schützt data.json. */
const MAX_SINGLE_SVG_BYTES = 262144;

/** Erneuter Netzversuch nach Fehlschlag, damit Offline Start nicht kleben bleibt. */
export const MISSING_TTL_MS = 5 * 60 * 1000;

export type CatalogSource = "devicon" | "simple" | "selfhosted";

const standDates: Record<CatalogSource, string | null> = {
  devicon: null,
  simple: null,
  selfhosted: null,
};

/** Stand je Quelle: Live Datum oder null für eingebaut. */
export function catalogStand(): Record<CatalogSource, string | null> {
  return { ...standDates };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await requestUrl({ url });
    if (res.status !== 200) return null;
    if (typeof res.text !== "string" || !res.text.includes("<svg")) {
      return null;
    }
    if (res.text.length > MAX_SINGLE_SVG_BYTES) return null;
    return res.text;
  } catch {
    return null;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await requestUrl({ url });
    if (res.status !== 200) return null;
    return JSON.parse(res.text);
  } catch {
    return null;
  }
}

/** Devicon per Name, Variante plain vor original vor line, ohne Wordmark. */
export async function fetchDeviconSvg(name: string): Promise<string | null> {
  if (!/^[a-z0-9]+$/.test(name)) return null;
  for (const variant of DEVICON_VARIANTS) {
    const svg = await fetchText(
      `https://cdn.jsdelivr.net/gh/devicons/devicon@${DEVICON_BRANCH}/icons/${name}/${name}-${variant}.svg`,
    );
    if (svg) return sanitizeSvg(svg);
  }
  return null;
}

export async function fetchSimpleSvg(slug: string): Promise<string | null> {
  if (!/^[a-z0-9]+$/.test(slug)) return null;
  const svg = await fetchText(
    `https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@${SIMPLE_BRANCH}/icons/${slug}.svg`,
  );
  return svg ? sanitizeSvg(svg) : null;
}

export async function fetchSelfhostSvg(ref: string): Promise<string | null> {
  if (!/^[a-z0-9-]+$/.test(ref)) return null;
  const svg = await fetchText(
    `https://cdn.jsdelivr.net/gh/selfhst/icons@${SELFHOST_BRANCH}/svg/${ref}.svg`,
  );
  return svg ? sanitizeSvg(svg) : null;
}

export interface LiveCatalogs {
  deviconNames: string[];
  deviconTags: Record<string, string[]>;
  simpleSlugs: string[];
  selfhost: Map<string, SelfhostEntry>;
  live: Record<CatalogSource, boolean>;
}

let catalogPromise: Promise<LiveCatalogs> | null = null;

/** Alle Kataloge live laden, mit eingebautem Rückfall je Quelle. */
export function loadCatalogs(): Promise<LiveCatalogs> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      // Vor jedem Lauf zurücksetzen. Sonst bleibt der Stand eines früheren
      // Live Ladens stehen, während der Katalog auf den eingebauten
      // zurückfällt: die Anzeige nennt ein Datum, das nicht mehr gilt, und
      // selfhostLightRefs() führt Light Varianten, die es live nicht mehr gibt.
      for (const source of Object.keys(standDates) as CatalogSource[]) {
        standDates[source] = null;
      }
      liveSelfhost = null;
      const [devicon, simple, selfhost] = await Promise.all([
        loadDeviconCatalog(),
        loadSimpleCatalog(),
        loadSelfhostCatalog(),
      ]);
      return {
        deviconNames: devicon.names,
        deviconTags: devicon.tags,
        simpleSlugs: simple.slugs,
        selfhost: selfhost.entries,
        live: {
          devicon: devicon.live,
          simple: simple.live,
          selfhosted: selfhost.live,
        },
      };
    })();
    catalogPromise.catch(() => {
      catalogPromise = null;
    });
  }
  return catalogPromise;
}

/** Katalog Cache leeren, nächster Zugriff lädt neu. */
export function clearCatalogCaches(): void {
  catalogPromise = null;
}

async function loadDeviconCatalog(): Promise<{
  names: string[];
  tags: Record<string, string[]>;
  live: boolean;
}> {
  const raw = await fetchJson(
    `https://cdn.jsdelivr.net/gh/devicons/devicon@${DEVICON_BRANCH}/devicon.json`,
  );
  if (Array.isArray(raw) && raw.length > 100) {
    const names: string[] = [];
    const tags: Record<string, string[]> = {};
    for (const item of raw) {
      const entry = item as { name?: unknown; tags?: unknown };
      if (typeof entry.name !== "string" || !/^[a-z0-9]+$/.test(entry.name)) {
        continue;
      }
      names.push(entry.name);
      if (Array.isArray(entry.tags)) {
        const clean = entry.tags
          .filter((t): t is string => typeof t === "string")
          .slice(0, 6);
        if (clean.length > 0) tags[entry.name] = clean;
      }
    }
    names.sort();
    if (names.length > 100) {
      standDates.devicon = today();
      return { names, tags, live: true };
    }
  }
  return { names: [...DEVICON_NAMES], tags: { ...DEVICON_TAGS }, live: false };
}

async function loadSimpleCatalog(): Promise<{
  slugs: string[];
  live: boolean;
}> {
  const slugs = await loadSimpleSlugs();
  if (slugs.length > SIMPLE_CDN_SLUGS.length) {
    return { slugs, live: true };
  }
  return { slugs: [...SIMPLE_CDN_SLUGS], live: false };
}

async function loadSimpleSlugs(): Promise<string[]> {
  try {
    const res = await requestUrl({
      url: `https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@${SIMPLE_BRANCH}/slugs.md`,
    });
    if (res.status === 200 && typeof res.text === "string") {
      const slugs: string[] = [];
      for (const line of res.text.split("\n")) {
        const m = /^\|\s*`[^`]+`\s*\|\s*`([a-z0-9]+)`\s*\|/.exec(line.trim());
        if (m && m[1]) slugs.push(m[1]);
      }
      const unique = [...new Set(slugs)].sort();
      if (unique.length > SIMPLE_CDN_SLUGS.length) {
        standDates.simple = today();
        return unique;
      }
    }
  } catch {
    /* Rückfall unten */
  }
  return [];
}

/** Alter Einstieg: volle Liste oder leere Liste für kuratierten Rückfall. */
export function fetchSimpleSlugs(): Promise<string[]> {
  return loadSimpleSlugs();
}

let liveSelfhost: Map<string, SelfhostEntry> | null = null;

async function loadSelfhostCatalog(): Promise<{
  entries: Map<string, SelfhostEntry>;
  live: boolean;
}> {
  const raw = await fetchJson(
    `https://cdn.jsdelivr.net/gh/selfhst/icons@${SELFHOST_BRANCH}/index.json`,
  );
  if (Array.isArray(raw) && raw.length > 100) {
    const entries = new Map<string, SelfhostEntry>();
    for (const item of raw) {
      const entry = item as {
        Reference?: unknown;
        SVG?: unknown;
        Light?: unknown;
        Tags?: unknown;
      };
      if (typeof entry.Reference !== "string") continue;
      const ref = entry.Reference.toLowerCase();
      if (!/^[a-z0-9-]+$/.test(ref) || entry.SVG !== "Yes") continue;
      const tags =
        typeof entry.Tags === "string"
          ? entry.Tags.split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 6)
          : [];
      entries.set(ref, { light: entry.Light === "Yes", tags });
    }
    if (entries.size > 100) {
      standDates.selfhosted = today();
      liveSelfhost = entries;
      return { entries, live: true };
    }
  }
  const fallback = new Map<string, SelfhostEntry>();
  for (const [ref, entry] of Object.entries(SELFHOST_CATALOG)) {
    fallback.set(ref, entry);
  }
  return { entries: fallback, live: false };
}

/** Referenzen mit heller Variante, eingebaut plus letzter Live Stand. */
let lightCache: {
  src: Map<string, SelfhostEntry> | null;
  set: Set<string>;
} | null = null;

export function selfhostLightRefs(): Set<string> {
  if (!lightCache || lightCache.src !== liveSelfhost) {
    const out = new Set<string>();
    for (const [ref, entry] of Object.entries(SELFHOST_CATALOG)) {
      if (entry.light) out.add(ref);
    }
    if (liveSelfhost) {
      for (const [ref, entry] of liveSelfhost) {
        if (entry.light) out.add(ref);
      }
    }
    lightCache = { src: liveSelfhost, set: out };
  }
  return lightCache.set;
}

export type CdnKind = "devicon" | "simple" | "selfhosted";

export function splitCdnRef(
  name: string,
): { kind: CdnKind; key: string } | null {
  if (name.startsWith("devicon/")) {
    const key = name.slice("devicon/".length);
    return key && !key.includes("/") ? { kind: "devicon", key } : null;
  }
  if (name.startsWith("simple/")) {
    const key = name.slice("simple/".length);
    return key && !key.includes("/") ? { kind: "simple", key } : null;
  }
  if (name.startsWith("selfhosted/")) {
    const key = name.slice("selfhosted/".length);
    return key && !key.includes("/") ? { kind: "selfhosted", key } : null;
  }
  return null;
}

/**
 * Geräte Cache für CDN Icons, Speicher plus Geräte Persistenz.
 * Negative Treffer nur im Speicher, damit ein späterer Versuch klappt.
 */
export class CdnCache {
  private cache = new Map<string, string>();
  private missing = new Map<string, number>();
  /** Laufende Abrufe, damit sechs Zeilen mit demselben Icon einen holen. */
  private inflight = new Map<string, Promise<string | null>>();
  private bytes = 0;
  private saveTimer = 0;
  private dirty = false;

  constructor(
    private persist: {
      load: () => Record<string, string>;
      save: (data: Record<string, string>) => void;
    },
  ) {
    try {
      const data = this.persist.load();
      for (const [key, svg] of Object.entries(data)) {
        if (typeof svg !== "string" || !svg.includes("<svg")) continue;
        if (
          this.cache.size >= MAX_ENTRIES ||
          this.bytes + svg.length > MAX_BYTES
        ) {
          break;
        }
        this.add(key, sanitizeSvg(svg));
      }
    } catch {
      /* leer starten */
    }
  }

  has(name: string): boolean {
    return this.cache.has(name);
  }

  /** Cache Treffer ohne Nachladen, für Speichern als Datei. */
  peek(name: string): string | undefined {
    return this.cache.get(name);
  }

  get size(): number {
    return this.cache.size;
  }

  /** Zwischengespeicherte Referenzen, für die Sammelaktion. */
  refs(): string[] {
    return [...this.cache.keys()];
  }

  clear(): void {
    this.cache.clear();
    this.missing.clear();
    this.inflight.clear();
    this.bytes = 0;
    this.dirty = false;
    this.persist.save({});
  }

  async getSvg(name: string): Promise<string | null> {
    const hit = this.cache.get(name);
    if (hit !== undefined) return hit;
    const pending = this.inflight.get(name);
    if (pending) return pending;
    const run = this.fetchOnce(name).finally(() => {
      this.inflight.delete(name);
    });
    this.inflight.set(name, run);
    return run;
  }

  private async fetchOnce(name: string): Promise<string | null> {
    const missedAt = this.missing.get(name);
    if (missedAt !== undefined) {
      if (Date.now() - missedAt < MISSING_TTL_MS) return null;
      this.missing.delete(name);
    }
    const split = splitCdnRef(name);
    if (!split) return null;
    const svg =
      split.kind === "devicon"
        ? await fetchDeviconSvg(split.key)
        : split.kind === "simple"
          ? await fetchSimpleSvg(split.key)
          : await fetchSelfhostSvg(split.key);
    if (!svg) {
      this.missing.set(name, Date.now());
      return null;
    }
    this.add(name, svg);
    this.scheduleSave();
    return svg;
  }

  private add(name: string, svg: string): void {
    // Zu groß fürs Budget: rendern ja, cachen nein.
    if (svg.length > MAX_BYTES) return;
    const old = this.cache.get(name);
    if (old !== undefined) {
      this.bytes -= old.length;
      this.cache.delete(name);
    }
    while (
      (this.cache.size >= MAX_ENTRIES || this.bytes + svg.length > MAX_BYTES) &&
      this.cache.size > 0
    ) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      const removed = this.cache.get(oldest.value);
      this.bytes -= removed ? removed.length : 0;
      this.cache.delete(oldest.value);
    }
    this.cache.set(name, svg);
    this.bytes += svg.length;
  }

  private scheduleSave(): void {
    this.dirty = true;
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.dirty = false;
      this.persist.save(this.cacheRecord());
    }, 2000);
  }

  /** Cache als Plain Object, ohne Object.fromEntries und ohne any. */
  private cacheRecord(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, svg] of this.cache) out[name] = svg;
    return out;
  }

  flush(): void {
    window.clearTimeout(this.saveTimer);
    if (!this.dirty) return;
    this.dirty = false;
    this.persist.save(this.cacheRecord());
  }
}
