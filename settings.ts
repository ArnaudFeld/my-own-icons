/**
 * Plugin Einstellungen samt Prüfung beim Laden.
 *
 * data.json ist für Nutzer sichtbar und wird von Obsidian Sync mitgenommen,
 * deshalb kommt kein Feld ungeprüft in den Betrieb: ein falscher Typ in einem
 * Pfadfeld bringt die Icon Suche mit einem TypeError zum Abbruch, ein String
 * statt Boolean schaltet das CDN ungefragt ein. Unbekannte Felder werden
 * verworfen, damit eine fremde Datei nichts in den Store schreibt.
 */
export interface MoiSettings {
  iconFolder: string;
  mappingFile: string;
  cdnEnabled: boolean;
  selfhostEnabled: boolean;
  saveFilesOnApply: boolean;
  autoLightVariant: boolean;
  showTabIcons: boolean;
  showTitleIcons: boolean;
}

export const DEFAULT_SETTINGS: MoiSettings = {
  iconFolder: "_assets/icons",
  mappingFile: "_assets/icon-mapping.json",
  cdnEnabled: false,
  selfhostEnabled: false,
  saveFilesOnApply: true,
  autoLightVariant: true,
  showTabIcons: true,
  showTitleIcons: true,
};

const STRING_FIELDS = ["iconFolder", "mappingFile"] as const;
export const BOOLEAN_FIELDS = [
  "cdnEnabled",
  "selfhostEnabled",
  "saveFilesOnApply",
  "autoLightVariant",
  "showTabIcons",
  "showTitleIcons",
] as const;

export type BooleanSettingKey = (typeof BOOLEAN_FIELDS)[number];

/**
 * True nur fuer die Schalter. Der Settings Tab braucht das, um einen key
 * ohne Cast auf eine Boolean zuzuordnen, und der Check in `k in
 * DEFAULT_SETTINGS` war zu weit: der traf auch auf die beiden Pfadfelder zu,
 * ein Boolean haette dort landen koennen.
 */
export function isBooleanSettingKey(key: string): key is BooleanSettingKey {
  return (BOOLEAN_FIELDS as readonly string[]).includes(key);
}

/**
 * Wert für Feld, Standard wenn unbrauchbar. Fehlerhafte Felder werden
 * einmalig auf der Konsole genannt, ohne den Start zu blockieren.
 */
export function readSettings(value: unknown): MoiSettings {
  const raw: Record<string, unknown> =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const out: MoiSettings = { ...DEFAULT_SETTINGS };
  const dropped: string[] = [];
  for (const key of STRING_FIELDS) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) {
      out[key] = v;
    } else if (v !== undefined) {
      dropped.push(key);
    }
  }
  for (const key of BOOLEAN_FIELDS) {
    const v = raw[key];
    if (typeof v === "boolean") {
      out[key] = v;
    } else if (v !== undefined) {
      dropped.push(key);
    }
  }
  if (dropped.length > 0) {
    console.warn(
      `[moi] Einstellungen unbrauchbar, Standard übernommen: ${dropped.join(", ")}`,
    );
  }
  return out;
}
