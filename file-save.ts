import { TFile, Vault } from "obsidian";

export type SaveResult = "written" | "exists" | "missing" | "failed";

/** Fehlende Ordnerebenen anlegen, vorhandene überspringen. */
export async function ensureFolder(
  vault: Vault,
  path: string,
): Promise<boolean> {
  let current = "";
  for (const part of path.split("/")) {
    if (!part) continue;
    current = current ? `${current}/${part}` : part;
    if (vault.getAbstractFileByPath(current)) continue;
    try {
      await vault.createFolder(current);
    } catch {
      // Von aussen angelegt, während wir liefen. Fehlt der Ordner danach
      // trotzdem, ist es ein echter Fehler.
      if (!vault.getAbstractFileByPath(current)) return false;
    }
  }
  return true;
}

/** SVG als Datei schreiben. Vorhandene Dateien bleiben unangetastet. */
export async function writeSvgFile(
  vault: Vault,
  folder: string,
  name: string,
  svg: string,
): Promise<SaveResult> {
  if (!folder) return "failed";
  const path = `${folder}/${name}.svg`;
  if (vault.getAbstractFileByPath(path) instanceof TFile) return "exists";
  const slash = path.lastIndexOf("/");
  if (slash > 0 && !(await ensureFolder(vault, path.slice(0, slash)))) {
    return "failed";
  }
  try {
    await vault.create(path, svg);
  } catch {
    return vault.getAbstractFileByPath(path) instanceof TFile
      ? "exists"
      : "failed";
  }
  return "written";
}
