import {
  App,
  Editor,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  SettingDefinitionItem,
  TAbstractFile,
  TFile,
  TFolder,
} from "obsidian";
import {
  Decoration,
  DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { StateEffect } from "@codemirror/state";
import {
  IconRef,
  IconStore,
  isDarkTheme,
  normalizeFolder,
  parseIconRef,
  renderIconInto,
} from "./icons";
import { MappingStore, normalizeExt } from "./mapping";
import {
  MoiSettings,
  DEFAULT_SETTINGS,
  isBooleanSettingKey,
  readSettings,
} from "./settings";
import { insideCode } from "./code-context";
import { ExplorerIcons } from "./explorer";
import { IconPickerModal, PickerMeta, PickerResult } from "./picker";
import { IconGalleryModal, IconCheckModal, SaveFilesModal } from "./gallery";
import { readFrontmatterIcon } from "./frontmatter";
import { writeSvgFile } from "./file-save";
import { ICON_TAG_RE, parseTagParams, refsInText } from "./shortcodes";
import {
  IconSuggest,
  FrontmatterSuggest,
  collectCatalogRefs,
  clearCatalogCache,
} from "./suggest";
import { TabsTitles } from "./tabs-titles";
import { exportIcons, importIcons } from "./exchange";
import { slogan, t } from "./i18n";

import {
  CdnCache,
  DEVICON_NAMES,
  SIMPLE_CDN_SLUGS,
  fetchSimpleSlugs,
  loadCatalogs,
  catalogStand,
  clearCatalogCaches,
  selfhostLightRefs,
} from "./cdn";
import { SELFHOST_DATE } from "./selfhost-catalog";

interface PluginEnvelope {
  settings?: MoiSettings;
  cdnCache?: Record<string, string>;
  recentIcons?: string[];
  favoriteIcons?: string[];
}

const RECENT_LIMIT = 10;
const FAVORITE_LIMIT = 200;
const CONFLICT_IDS = ["iconic", "obsidian-iconize", "obsidian-icon-folder"];

/** Explizite Dunkel Variante, sonst Self-Hosted Auto Light, sonst wie hell. */
function resolveDarkRef(
  ref: IconRef,
  dark: IconRef | null,
  autoLight: boolean,
): IconRef {
  if (!isDarkTheme()) return ref;
  if (dark) return dark;
  if (autoLight && ref.kind === "svg" && ref.name.startsWith("selfhosted/")) {
    const key = ref.name.slice("selfhosted/".length);
    if (selfhostLightRefs().has(key)) {
      return { kind: "svg", name: `${ref.name}-light` };
    }
  }
  return ref;
}

class IconWidget extends WidgetType {
  private readonly darkMode: boolean;
  constructor(
    private ref: IconRef,
    private size: string | undefined,
    private color: string | undefined,
    private dark: IconRef | null,
    private store: IconStore,
  ) {
    super();
    this.darkMode = isDarkTheme();
  }

  eq(other: IconWidget): boolean {
    const a = this.ref as {
      kind: string;
      name?: string;
      id?: string;
      char?: string;
    };
    const b = other.ref as {
      kind: string;
      name?: string;
      id?: string;
      char?: string;
    };
    const da = this.dark as unknown as {
      kind?: string;
      name?: string;
      id?: string;
    } | null;
    const db = other.dark as unknown as {
      kind?: string;
      name?: string;
      id?: string;
    } | null;
    return (
      a.kind === b.kind &&
      a.name === b.name &&
      a.id === b.id &&
      a.char === b.char &&
      this.size === other.size &&
      this.color === other.color &&
      this.darkMode === other.darkMode &&
      da?.name === db?.name &&
      da?.id === db?.id &&
      da?.kind === db?.kind
    );
  }

  toDOM(): HTMLElement {
    // Ohne document als Empfaenger: die Obsidian Helfer haengen ihr Ergebnis
    // an den Empfaenger, und ein Dokument darf nur ein Kind haben. Die globale
    // Variante liefert ein losgeloestes Element, document.createElement auch.
    const span = createSpan();
    const ref = this.darkMode && this.dark ? this.dark : this.ref;
    void renderIconInto(span, ref, this.store, {
      size: this.size,
      color: this.color,
    }).catch(() => {
      span.setText("?");
    });
    return span;
  }
}

/** Theme Wechsel als Effekt, damit Live Preview Icons neu bauen. */
const iconThemeEffect = StateEffect.define<number>();

/** Im gerenderten HTML: Text unter pre oder code gehört dem Nutzer. */
export function insideRenderedCode(node: Node): boolean {
  const parent = node.parentElement;
  return parent ? parent.closest("pre, code") !== null : false;
}

function buildIconExtension(
  store: IconStore,
  getAutoLight: () => boolean,
): Extension {
  const matcher = new MatchDecorator({
    regexp: new RegExp(ICON_TAG_RE.source, "g"),
    decoration: (match, view, pos) => {
      if (insideCode(view.state.doc, pos)) return null;
      const ref = parseIconRef(match[1] ?? "");
      if (!ref || ref.kind === "emoji") return null;
      const end = pos + match[0].length;
      for (const range of view.state.selection.ranges) {
        if (range.from <= end && range.to >= pos) return null;
      }
      const { size, color, darkIcon } = parseTagParams(
        match[2],
        match[3],
        match[4],
      );
      const dark = darkIcon ? parseIconRef(darkIcon) : null;
      const useRef = resolveDarkRef(ref, dark, getAutoLight());
      return Decoration.replace({
        widget: new IconWidget(useRef, size, color, dark, store),
        inclusive: false,
      });
    },
  });

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = matcher.createDeco(view);
      }
      update(update: ViewUpdate): void {
        for (const tr of update.transactions) {
          for (const e of tr.effects) {
            if (e.is(iconThemeEffect)) {
              this.decorations = matcher.createDeco(update.view);
              return;
            }
          }
        }
        this.decorations = matcher.updateDeco(update, this.decorations);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

export default class MoiPlugin extends Plugin {
  settings: MoiSettings = { ...DEFAULT_SETTINGS };
  private icons!: IconStore;
  private mapping!: MappingStore;
  private explorer!: ExplorerIcons;
  private cdn!: CdnCache;
  private chrome!: TabsTitles;

  async onload(): Promise<void> {
    await this.loadAll();
    this.cdn = new CdnCache({
      load: () => this.cdnData,
      save: (data) => {
        this.cdnData = data;
        void this.saveAll();
      },
    });
    this.icons = new IconStore(this.app, () => this.settings.iconFolder, {
      enabled: () => this.settings.cdnEnabled,
      getSvg: (name) => this.cdn.getSvg(name),
    });
    this.mapping = new MappingStore(this.app, () => this.settings.mappingFile);
    await this.mapping.load();
    this.explorer = new ExplorerIcons(
      this.app,
      this.icons,
      this.mapping,
      () => this.settings.autoLightVariant,
    );
    this.chrome = new TabsTitles(this.app, this.icons, this.mapping, () => ({
      tabs: this.settings.showTabIcons,
      title: this.settings.showTitleIcons,
      autoLight: this.settings.autoLightVariant,
    }));

    // Live Preview (CM6)
    this.registerEditorExtension(
      buildIconExtension(this.icons, () => this.settings.autoLightVariant),
    );

    // Autovervollständigung für {{icon:…}} beim Tippen
    this.registerEditorSuggest(
      new IconSuggest(this.app, this.icons, {
        cdn: () => this.settings.cdnEnabled,
        selfhost: () => this.settings.selfhostEnabled,
        touch: (ref) => this.touchRecent([ref]),
      }),
    );

    // Vorschläge für icon, iconColor und iconDark im Frontmatter
    this.registerEditorSuggest(
      new FrontmatterSuggest(this.app, this.icons, () => ({
        cdn: this.settings.cdnEnabled,
        selfhost: this.settings.selfhostEnabled,
      })),
    );

    // Lesemodus
    this.registerMarkdownPostProcessor(async (el) => {
      await this.postProcess(el);
    });

    this.app.workspace.onLayoutReady(() => {
      this.explorer.start();
      this.chrome.start();
      this.warnOnConflicts();
    });
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.explorer.refreshSoon();
        this.chrome.refreshSoon();
      }),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () =>
        this.chrome.refreshSoon(),
      ),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", () => this.chrome.refreshSoon()),
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", () => this.chrome.refreshSoon()),
    );
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        this.app.workspace.updateOptions();
        this.explorer.refreshSoon();
        this.chrome.refreshSoon();
        this.refreshEditorIcons();
      }),
    );

    this.registerEvent(this.app.vault.on("create", (f) => this.onVault(f)));
    this.registerEvent(this.app.vault.on("modify", (f) => this.onVault(f)));
    this.registerEvent(this.app.vault.on("delete", (f) => this.onDelete(f)));
    this.registerEvent(
      this.app.vault.on("rename", (f, oldPath) => this.onRename(f, oldPath)),
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        menu.addItem((item) =>
          item
            .setTitle(t("menu.change"))
            .setIcon("image-plus")
            .onClick(() => this.openPicker([file.path])),
        );
        if (this.mapping.get(file.path)) {
          menu.addItem((item) =>
            item
              .setTitle(t("menu.remove"))
              .setIcon("trash")
              .onClick(() => this.removeIcons([file.path])),
          );
        }
      }),
    );
    this.registerEvent(
      this.app.workspace.on("files-menu", (menu, files) => {
        const paths = files.map((f) => f.path);
        menu.addItem((item) =>
          item
            .setTitle(t("menu.changeMany", { count: paths.length }))
            .setIcon("image-plus")
            .onClick(() => this.openPicker(paths)),
        );
        if (paths.some((p) => this.mapping.get(p))) {
          menu.addItem((item) =>
            item
              .setTitle(t("menu.removeMany", { count: paths.length }))
              .setIcon("trash")
              .onClick(() => this.removeIcons(paths)),
          );
        }
      }),
    );

    this.addCommand({
      id: "reload-icons",
      name: t("cmd.reload"),
      callback: () => {
        this.icons.clear();
        void this.mapping.load().then(() => this.explorer.refresh());
        this.app.workspace.updateOptions();
      },
    });

    this.addCommand({
      id: "open-gallery",
      name: t("cmd.gallery"),
      callback: () => {
        new IconGalleryModal(this.app, this.icons, this.mapping, () => {
          this.refreshViews();
        }).open();
      },
    });

    this.addCommand({
      id: "check-icons",
      name: t("cmd.check"),
      callback: () => {
        void this.runIconCheck().then((result) => {
          if (result.broken.length === 0) {
            new Notice(
              t("notice.checkOk", { used: result.used, unused: result.unused }),
            );
          } else {
            new IconCheckModal(this.app, result).open();
          }
        });
      },
    });

    this.addCommand({
      id: "export-icons",
      name: t("cmd.export"),
      callback: () => {
        void exportIcons(this.app, this.icons, this.mapping);
      },
    });

    this.addCommand({
      id: "import-icons",
      name: t("cmd.import"),
      callback: () => {
        this.importPackage();
      },
    });

    this.addCommand({
      id: "pick-icon-active-file",
      name: t("cmd.pickActive"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) this.openPicker([file.path]);
        return true;
      },
    });

    this.addCommand({
      id: "insert-icon-at-cursor",
      name: t("cmd.insert"),
      editorCallback: (editor) => {
        this.openInsertPicker(editor);
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        menu.addItem((item) =>
          item
            .setTitle(t("menu.insert"))
            .setIcon("plus")
            .onClick(() => this.openInsertPicker(editor)),
        );
        const file = view.file;
        if (!(file instanceof TFile)) return;
        menu.addItem((item) =>
          item
            .setTitle(t("menu.change"))
            .setIcon("image-plus")
            .onClick(() => this.openPicker([file.path])),
        );
        if (this.mapping.get(file.path)) {
          menu.addItem((item) =>
            item
              .setTitle(t("menu.remove"))
              .setIcon("trash")
              .onClick(() => this.removeIcons([file.path])),
          );
        }
      }),
    );

    this.addSettingTab(new MoiSettingTab(this.app, this));
  }

  onunload(): void {
    window.clearTimeout(this.metaTimer);
    window.clearTimeout(this.settingsTimer);
    this.cdn?.flush();
    void this.saveAll();
    void this.mapping?.flush();
    this.explorer?.stop();
    this.chrome?.stop();
  }

  /** Hinweis bei Iconic oder Iconize, beide kämpfen um dieselben DOM Stellen. */
  private warnedConflicts = false;

  private warnOnConflicts(): void {
    if (this.warnedConflicts) return;
    this.warnedConflicts = true;
    const plugins = (
      this.app as unknown as { plugins?: { plugins?: Record<string, unknown> } }
    ).plugins?.plugins;
    if (!plugins) return;
    const found = CONFLICT_IDS.filter((id) =>
      Object.prototype.hasOwnProperty.call(plugins, id),
    );
    if (found.length > 0) {
      new Notice(
        `M.O.I.: ${t("notice.conflict", { names: found.join(", ") })}`,
        9000,
      );
    }
  }
  /** Live Preview Deko in allen Editoren neu bauen, etwa nach Theme Wechsel. */
  private refreshEditorIcons(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const editor = (leaf.view as unknown as { editor?: { cm?: EditorView } })
        .editor?.cm;
      if (!editor) continue;
      try {
        editor.dispatch({ effects: iconThemeEffect.of(Date.now()) });
      } catch {
        // Ansicht ohne lebendigen Editor, ignorieren.
      }
    }
  }

  private onVault(file: TAbstractFile | string): void {
    const path = typeof file === "string" ? file : file.path;
    if (this.mapping.isMappingPath(path)) {
      void this.mapping.load().then(() => {
        void this.explorer.refresh();
        this.chrome.refreshSoon();
      });
      return;
    }
    // Der Hook hängt an jedem Speichern im Vault. Alles ausserhalb des Icon
    // Ordners und ausser SVG kann weder den Icon Cache noch den Katalog Cache
    // betreffen, also frueh zurueck.
    const isSvg = path.toLowerCase().endsWith(".svg");
    if (!isSvg && !this.icons.handlesPath(path)) return;
    this.icons.invalidatePath(path);
    if (isSvg) clearCatalogCache();
  }

  private onRename(file: TAbstractFile, oldPath: string): void {
    if (this.mapping.isMappingPath(file.path)) return;
    const isFolder = file instanceof TFolder;
    void this.mapping
      .migrateRename(oldPath, file.path, isFolder)
      .then((changed) => {
        if (changed) this.explorer.refreshSoon();
        this.chrome.refreshSoon();
      });
  }

  private onDelete(file: TAbstractFile): void {
    const path = file.path;
    if (this.mapping.isMappingPath(path)) return;
    const isFolder = file instanceof TFolder;
    void this.mapping.removePath(path, isFolder).then((changed) => {
      if (changed) {
        this.explorer.refreshSoon();
        this.chrome.refreshSoon();
      }
    });
    this.icons.invalidatePath(path);
    if (path.toLowerCase().endsWith(".svg")) clearCatalogCache();
  }

  openExtPicker(
    ext: string,
    initial: PickerResult | null,
    onSaved?: () => void,
  ): void {
    this.openIconPicker(initial, (result) => {
      void (async () => {
        try {
          await this.mapping.setExt(ext, {
            icon: result.icon,
            ...(result.color ? { color: result.color } : {}),
            ...(result.size ? { size: result.size } : {}),
            ...(result.iconDark ? { iconDark: result.iconDark } : {}),
          });
          this.touchRecent([result.icon]);
          this.explorer.refreshSoon();
          this.chrome.refreshSoon();
          onSaved?.();
        } catch {
          new Notice(t("notice.iconSaveFailed"));
        }
      })();
    });
  }

  private openPicker(paths: string[]): void {
    const first = paths.length === 1 ? this.mapping.get(paths[0]) : null;
    const initial: PickerResult | null = first
      ? {
          icon: first.icon,
          ...(first.color ? { color: first.color } : {}),
          ...(first.size ? { size: first.size } : {}),
          ...(first.iconDark ? { iconDark: first.iconDark } : {}),
        }
      : null;
    this.openIconPicker(initial, (result) => {
      void this.applyIcons(paths, result);
    });
  }

  /** Tote Favoriten und Zuletzt Einträge entfernen, einmal pro Dialog.
   * Nur Quellen mit vollständigem Stand werden beurteilt, der Rest bleibt.
   */
  private async pruneMeta(cdnRefs: string[]): Promise<void> {
    const local = new Set(await this.icons.listSvgNames());
    let lucide: Set<string> | null = null;
    try {
      const ids = this.icons.lucideIds();
      if (ids.length > 0) lucide = new Set(ids.map((id) => `lucide:${id}`));
    } catch {
      lucide = null;
    }
    const cdn = this.settings.cdnEnabled
      ? new Set(
          cdnRefs.filter(
            (ref) => ref.startsWith("devicon/") || ref.startsWith("simple/"),
          ),
        )
      : null;
    const selfhosted = this.settings.selfhostEnabled
      ? new Set(cdnRefs.filter((ref) => ref.startsWith("selfhosted/")))
      : null;
    const sourceSet = (ref: string): Set<string> | null | undefined => {
      if (ref.startsWith("lucide:")) return lucide;
      if (ref.startsWith("devicon/") || ref.startsWith("simple/")) return cdn;
      if (ref.startsWith("selfhosted/")) return selfhosted;
      return undefined;
    };
    const known = (ref: string): boolean => {
      if (local.has(ref)) return true;
      const set = sourceSet(ref);
      return set !== null && set !== undefined && set.has(ref);
    };
    const judgeable = (ref: string): boolean => {
      if (local.has(ref)) return true;
      return sourceSet(ref) !== null;
    };
    let changed = false;
    const keep = (list: string[]): string[] =>
      list.filter((ref) => {
        if (known(ref) || !judgeable(ref)) return true;
        changed = true;
        return false;
      });
    this.favoriteIcons = keep(this.favoriteIcons);
    this.recentIcons = keep(this.recentIcons).slice(0, RECENT_LIMIT);
    if (changed) await this.saveAll();
  }

  /** Gleicher Dialog zum Einfügen als Shortcode in die Notiz. */
  private openInsertPicker(editor: Editor): void {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line) ?? "";
    this.openIconPicker(null, (result) => {
      const parts = [result.icon];
      if (result.size) parts.push(result.size);
      if (result.color) parts.push(result.color);
      if (result.iconDark) parts.push(`dark:${result.iconDark}`);
      const tag = `{{icon:${parts.join("|")}}}`;
      editor.setCursor(cursor);
      const before = line.slice(0, cursor.ch);
      const after = line.slice(cursor.ch);
      const prefix = before.length > 0 && !/\s$/.test(before) ? " " : "";
      const suffix = after.length > 0 && !/^\s/.test(after) ? " " : "";
      editor.replaceSelection(`${prefix}${tag}${suffix}`);
      this.touchRecent([result.icon]);
    });
  }

  private openIconPicker(
    initial: PickerResult | null,
    onPick: (result: PickerResult) => void,
  ): void {
    // Dialog sofort öffnen, Katalog trifft async ein. Ohne Netz nur lokale Icons.
    const meta: PickerMeta = {
      favorites: [...this.favoriteIcons],
      recent: [...this.recentIcons],
      onToggleFavorite: (ref) => {
        this.toggleFavorite(ref);
        meta.favorites = [...this.favoriteIcons];
      },
    };
    const modal = new IconPickerModal(
      this.app,
      this.icons,
      initial,
      (result) => {
        if (result) onPick(result);
      },
      [],
      (ref) => {
        void this.saveCdnToFile(ref);
      },
      meta,
    );
    modal.open();
    void this.cdnRefs()
      .then(async (refs) => {
        await this.pruneMeta(refs);
        meta.favorites = [...this.favoriteIcons];
        meta.recent = [...this.recentIcons];
        await modal.refreshCdnRefs(refs);
      })
      .catch(() => {
        // Nur lokale Icons, Katalog bleibt leer.
      });
  }

  /** Katalog Referenzen, die nur per CDN verfügbar sind, nicht als Datei. */
  private async cdnRefs(): Promise<string[]> {
    if (!this.settings.cdnEnabled && !this.settings.selfhostEnabled) return [];
    const local = new Set(await this.icons.listSvgNames());
    try {
      const catalog = await collectCatalogRefs(this.icons, {
        cdn: this.settings.cdnEnabled,
        selfhost: this.settings.selfhostEnabled,
      });
      return catalog.refs.filter((ref) => ref.includes("/") && !local.has(ref));
    } catch {
      return [];
    }
  }

  private async applyIcons(
    paths: string[],
    result: PickerResult,
  ): Promise<void> {
    const entry = {
      icon: result.icon,
      ...(result.color ? { color: result.color } : {}),
      ...(result.size ? { size: result.size } : {}),
      ...(result.iconDark ? { iconDark: result.iconDark } : {}),
    };
    try {
      await this.mapping.setMany(
        paths.map((path) => [path, entry] as [string, typeof entry]),
      );
    } catch {
      new Notice(t("notice.iconsSaveFailed"));
      return;
    }
    this.touchRecent([result.icon]);
    this.explorer.refreshSoon();
    this.chrome.refreshSoon();
    if (this.settings.saveFilesOnApply) {
      for (const ref of [result.icon, result.iconDark]) {
        if (!ref || parseIconRef(ref)?.kind !== "svg") continue;
        // Ohne Warten, und nur was schon im Cache liegt: der Picker hat es
        // gerade geholt, ein eigenes SVG ist bereits eine Datei.
        void this.writeCdnFile(ref);
      }
    }
  }

  private touchRecent(refs: string[]): void {
    const seen = new Set(this.recentIcons);
    for (const ref of refs) {
      if (seen.has(ref)) {
        this.recentIcons = this.recentIcons.filter((r) => r !== ref);
      }
      this.recentIcons.unshift(ref);
      seen.add(ref);
    }
    this.recentIcons = this.recentIcons.slice(0, RECENT_LIMIT);
    this.saveMetaSoon();
  }

  /** Meta Writes bündeln, das Envelope mit Cache ist groß. */
  private metaTimer = 0;

  private saveMetaSoon(): void {
    window.clearTimeout(this.metaTimer);
    this.metaTimer = window.setTimeout(() => {
      void this.saveAll();
    }, 500);
  }

  toggleFavorite(ref: string): boolean {
    const index = this.favoriteIcons.indexOf(ref);
    if (index >= 0) this.favoriteIcons.splice(index, 1);
    else this.favoriteIcons.push(ref);
    if (this.favoriteIcons.length > FAVORITE_LIMIT) {
      this.favoriteIcons = this.favoriteIcons.slice(-FAVORITE_LIMIT);
    }
    this.saveMetaSoon();
    return index < 0;
  }

  private async removeIcons(paths: string[]): Promise<void> {
    try {
      await this.mapping.removeMany(paths);
    } catch {
      new Notice(t("notice.iconsRemoveFailed"));
      return;
    }
    this.explorer.refreshSoon();
    this.chrome.refreshSoon();
  }

  /** CDN Icon aus dem Cache als SVG Datei in den Icon Ordner schreiben. */
  private savingFiles = new Set<string>();

  private async writeCdnFile(
    ref: string,
  ): Promise<"written" | "exists" | "missing" | "failed"> {
    const parsed = parseIconRef(ref);
    if (!parsed || parsed.kind !== "svg") return "failed";
    const svg = this.cdn.peek(ref);
    if (!svg) return "missing";
    const folder = normalizeFolder(this.settings.iconFolder);
    const path = `${folder}/${parsed.name}.svg`;
    if (this.savingFiles.has(path)) return "exists";
    this.savingFiles.add(path);
    try {
      const result = await writeSvgFile(
        this.app.vault,
        folder,
        parsed.name,
        svg,
      );
      if (result === "written") {
        this.icons.invalidatePath(path);
        this.explorer.refreshSoon();
      }
      return result;
    } finally {
      this.savingFiles.delete(path);
    }
  }

  private async saveCdnToFile(ref: string): Promise<void> {
    const parsed = parseIconRef(ref);
    if (!parsed || parsed.kind !== "svg") {
      new Notice(t("notice.onlySvg"));
      return;
    }
    const result = await this.writeCdnFile(ref);
    if (result === "written") {
      new Notice(
        t("notice.saved", {
          path: `${normalizeFolder(this.settings.iconFolder)}/${parsed.name}.svg`,
        }),
      );
      return;
    }
    if (result === "exists") {
      new Notice(t("notice.fileExists"));
      return;
    }
    if (result === "missing") {
      new Notice(t("notice.notInCache"));
      return;
    }
    new Notice(t("notice.fileSaveFailed"));
  }

  private savingAll = false;

  /** SVG Referenzen aus Mapping, Endungen, Frontmatter und Shortcodes. */
  private async collectUsedRefs(): Promise<Set<string>> {
    const refs = new Set<string>();
    const add = (raw: string | undefined): void => {
      if (!raw) return;
      const parsed = parseIconRef(raw);
      if (parsed?.kind === "svg") refs.add(parsed.name);
    };
    for (const [, entry] of this.mapping.entries()) {
      add(entry.icon);
      add(entry.iconDark);
    }
    for (const [, entry] of this.mapping.extEntries()) {
      add(entry.icon);
      add(entry.iconDark);
    }
    for (const file of this.app.vault.getMarkdownFiles()) {
      const frontmatter = readFrontmatterIcon(this.app, file);
      if (frontmatter) {
        add(frontmatter.icon);
        add(frontmatter.iconDark);
      }
      let text = "";
      try {
        text = await this.app.vault.cachedRead(file);
      } catch {
        continue;
      }
      for (const ref of refsInText(text)) refs.add(ref);
    }
    return refs;
  }

  /**
   * Verwendete oder zwischengespeicherte Icons als SVG in den Icon Ordner
   * schreiben. `null` heisst: Dialog abgebrochen.
   */
  async saveAllIconFiles(): Promise<{
    written: number;
    exists: number;
    failed: number;
  } | null> {
    if (this.savingAll) return null;
    this.savingAll = true;
    const scanning = new Notice(t("notice.scanning"), 0);
    try {
      const folder = normalizeFolder(this.settings.iconFolder);
      const used = await this.collectUsedRefs();
      const cached = new Set(this.cdn.refs());
      const targets = (
        source: Set<string>,
      ): { todo: string[]; exists: number } => {
        const todo: string[] = [];
        let exists = 0;
        for (const ref of source) {
          const parsed = parseIconRef(ref);
          if (!parsed || parsed.kind !== "svg") continue;
          const path = `${folder}/${parsed.name}.svg`;
          if (this.app.vault.getAbstractFileByPath(path) instanceof TFile) {
            exists++;
          } else {
            todo.push(ref);
          }
        }
        return { todo, exists };
      };
      const usedTargets = targets(used);
      const allTargets = targets(new Set([...used, ...cached]));
      scanning.hide();
      const mode = await new Promise<"used" | "all" | null>((resolve) => {
        new SaveFilesModal(
          this.app,
          {
            used: {
              count: usedTargets.todo.length,
              exists: usedTargets.exists,
            },
            all: { count: allTargets.todo.length, exists: allTargets.exists },
          },
          resolve,
        ).open();
      });
      if (!mode) return null;
      const chosen = mode === "used" ? usedTargets : allTargets;
      let written = 0;
      let failed = 0;
      const failedRefs: string[] = [];
      for (const ref of chosen.todo) {
        // getSvg bedient sich am Cache und lädt nur nach, was fehlt.
        if (!(await this.cdn.getSvg(ref))) {
          failed++;
          failedRefs.push(ref);
          continue;
        }
        const result = await this.writeCdnFile(ref);
        if (result === "written") written++;
        else if (result !== "exists") {
          failed++;
          failedRefs.push(ref);
        }
      }
      if (failedRefs.length > 0) {
        console.warn(`[moi] Icons nicht speicherbar: ${failedRefs.join(", ")}`);
      }
      return { written, exists: chosen.exists, failed };
    } finally {
      scanning.hide();
      this.savingAll = false;
    }
  }

  cacheSize(): number {
    return this.cdn?.size ?? 0;
  }

  refreshViews(): void {
    this.explorer.refreshSoon();
    this.chrome.refreshSoon();
    this.app.workspace.updateOptions();
  }

  catalogStandText(): string {
    const stand = catalogStand();
    const parts: string[] = [];
    if (this.settings.cdnEnabled) {
      parts.push(
        t("cat.devicon", {
          value: stand.devicon ?? t("cat.builtinVersion"),
        }),
      );
      parts.push(
        t("cat.simple", { value: stand.simple ?? t("cat.builtinCurated") }),
      );
    }
    if (this.settings.selfhostEnabled) {
      parts.push(
        t("cat.selfhost", {
          value:
            stand.selfhosted ?? t("cat.builtinDate", { date: SELFHOST_DATE }),
        }),
      );
    }
    return parts.length > 0 ? parts.join(" · ") : t("cat.off");
  }

  async reloadCatalogs(): Promise<void> {
    clearCatalogCaches();
    clearCatalogCache();
    try {
      await loadCatalogs();
    } catch {
      /* Rückfall bleibt */
    }
    this.explorer.refreshSoon();
    this.chrome.refreshSoon();
    this.app.workspace.updateOptions();
  }

  iconStore(): IconStore {
    return this.icons;
  }

  iconMapping(): MappingStore {
    return this.mapping;
  }

  importPackage(): void {
    importIcons(
      this.app,
      this.icons,
      this.mapping,
      () => this.settings.iconFolder,
      () => {
        this.explorer.refreshSoon();
        this.chrome.refreshSoon();
      },
    );
  }

  /**
   * Prüft alle Mapping Einträge ohne Netz: Datei da, Lucide bekannt,
   * Emoji gesetzt oder per CDN auflösbar. Zählt ungenutzte Dateien.
   */
  async runIconCheck(): Promise<{
    broken: [string, string][];
    used: number;
    unused: number;
  }> {
    const broken: [string, string][] = [];
    const local = new Set(await this.icons.listSvgNames());
    const lucide = new Set(this.icons.lucideIds());
    const resolvable = new Set<string>(local);
    if (this.settings.cdnEnabled || this.settings.selfhostEnabled) {
      try {
        const catalogs = await loadCatalogs();
        if (this.settings.cdnEnabled) {
          for (const name of catalogs.deviconNames) {
            resolvable.add(`devicon/${name}`);
          }
          for (const slug of catalogs.simpleSlugs) {
            resolvable.add(`simple/${slug}`);
          }
        }
        if (this.settings.selfhostEnabled) {
          for (const ref of catalogs.selfhost.keys()) {
            resolvable.add(`selfhosted/${ref}`);
          }
        }
      } catch {
        if (this.settings.cdnEnabled) {
          for (const name of DEVICON_NAMES) resolvable.add(`devicon/${name}`);
          let slugs = SIMPLE_CDN_SLUGS;
          try {
            const live = await fetchSimpleSlugs();
            if (live.length > 0) slugs = live;
          } catch {
            /* kuratiert */
          }
          for (const slug of slugs) resolvable.add(`simple/${slug}`);
        }
      }
    }
    const entries = this.mapping.entries();
    const refOk = (ref: IconRef | null): boolean => {
      if (!ref) return false;
      if (ref.kind === "emoji") return ref.char.length > 0;
      if (ref.kind === "lucide") return lucide.has(ref.id);
      if (resolvable.has(ref.name)) return true;
      if (ref.name.startsWith("selfhosted/") && ref.name.endsWith("-light")) {
        const base = ref.name.slice("selfhosted/".length, -"-light".length);
        if (
          selfhostLightRefs().has(base) &&
          resolvable.has(`selfhosted/${base}`)
        ) {
          return true;
        }
      }
      return (
        (this.settings.cdnEnabled || this.settings.selfhostEnabled) &&
        !!this.cdn.peek(ref.name)
      );
    };
    for (const [path, entry] of [
      ...entries,
      ...this.mapping
        .extEntries()
        .map(([ext, value]): [string, typeof value] => [`*.${ext}`, value]),
    ]) {
      if (!refOk(parseIconRef(entry.icon))) broken.push([path, entry.icon]);
      if (entry.iconDark && !refOk(parseIconRef(entry.iconDark))) {
        broken.push([`${path} (dunkel)`, entry.iconDark]);
      }
    }
    const used = new Set<string>();
    for (const [, entry] of [...entries, ...this.mapping.extEntries()]) {
      const ref = parseIconRef(entry.icon);
      if (ref?.kind === "svg") used.add(ref.name);
      if (entry.iconDark) {
        const dark = parseIconRef(entry.iconDark);
        if (dark?.kind === "svg") used.add(dark.name);
      }
    }
    let unused = 0;
    for (const name of local) {
      if (!used.has(name)) unused++;
    }
    return {
      broken,
      used: entries.length + this.mapping.extEntries().length,
      unused,
    };
  }

  clearCache(): void {
    this.cdn?.clear();
    this.icons.clear();
    this.explorer.refreshSoon();
    this.app.workspace.updateOptions();
  }

  private async postProcess(el: HTMLElement): Promise<void> {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
      const current = walker.currentNode as Text;
      if (
        current.nodeValue &&
        current.nodeValue.includes("{{icon:") &&
        !insideRenderedCode(current)
      ) {
        nodes.push(current);
      }
    }
    for (const node of nodes) {
      await this.replaceInTextNode(node);
    }
  }

  private async replaceInTextNode(node: Text): Promise<void> {
    const text = node.nodeValue ?? "";
    const re = new RegExp(ICON_TAG_RE.source, "g");
    let m: RegExpExecArray | null;
    let last = 0;
    let found = false;
    const frag = createFragment();

    while ((m = re.exec(text)) !== null) {
      found = true;
      if (m.index > last) frag.appendText(text.slice(last, m.index));
      const ref = parseIconRef(m[1] ?? "");
      const { size, color, darkIcon } = parseTagParams(m[2], m[3], m[4]);
      const dark = darkIcon ? parseIconRef(darkIcon) : null;
      if (!ref || ref.kind === "emoji") {
        frag.appendText(m[0]);
      } else {
        const span = createSpan();
        await renderIconInto(
          span,
          resolveDarkRef(ref, dark, this.settings.autoLightVariant),
          this.icons,
          { size, color },
        );
        frag.append(span);
      }
      last = m.index + m[0].length;
    }

    if (!found) return;
    if (last < text.length) frag.appendText(text.slice(last));
    node.parentNode?.replaceChild(frag, node);
  }

  private cdnData: Record<string, string> = {};
  private recentIcons: string[] = [];
  private favoriteIcons: string[] = [];

  private isEnvelope(value: unknown): value is PluginEnvelope {
    if (!value || typeof value !== "object") return false;
    const keys = ["settings", "cdnCache", "recentIcons", "favoriteIcons"];
    return keys.some((k) => k in (value as Record<string, unknown>));
  }

  private asStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === "string");
  }

  async loadAll(): Promise<void> {
    let raw: unknown = null;
    try {
      raw = await this.loadData();
    } catch {
      console.warn("[moi] data.json ungültig, Standard geladen");
    }
    if (this.isEnvelope(raw)) {
      this.settings = readSettings(raw.settings);
      this.cdnData = raw.cdnCache ?? {};
      this.recentIcons = this.asStringList(raw.recentIcons).slice(
        0,
        RECENT_LIMIT,
      );
      this.favoriteIcons = [
        ...new Set(this.asStringList(raw.favoriteIcons)),
      ].slice(-FAVORITE_LIMIT);
    } else {
      this.settings = readSettings(raw);
      this.cdnData = {};
      this.recentIcons = [];
      this.favoriteIcons = [];
    }
  }

  /** Aufeinanderfolgende Saves, damit sich parallele Writes nicht überholen. */
  private dataSaveQueue: Promise<void> = Promise.resolve();

  private saveAll(): Promise<void> {
    const run = this.dataSaveQueue.then(() => this.writeAll());
    this.dataSaveQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async writeAll(): Promise<void> {
    const envelope: PluginEnvelope = {
      settings: this.settings,
      cdnCache: this.cdnData,
      recentIcons: this.recentIcons,
      favoriteIcons: this.favoriteIcons,
    };
    await this.saveData(envelope);
  }

  async loadSettings(): Promise<void> {
    await this.loadAll();
  }

  async saveSettings(): Promise<void> {
    await this.saveAll();
    this.icons.clear();
    await this.mapping.load();
    this.explorer.refreshSoon();
    this.chrome.refreshSoon();
    this.refreshEditorIcons();
    this.app.workspace.updateOptions();
  }

  /** Textfelder entprellen, ein Save pro Tipp-Pause reicht. */
  private settingsTimer = 0;

  saveSettingsSoon(): void {
    window.clearTimeout(this.settingsTimer);
    this.settingsTimer = window.setTimeout(() => {
      void this.saveSettings();
    }, 500);
  }
}

class MoiSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: MoiPlugin,
  ) {
    super(app, plugin);
  }

  /**
   * Die Steuerelemente schreiben nicht ueber saveData, das Plugin haelt den
   * Icon Cache und die Favoriten im selben Envelope. Ohne diese beiden Hooks
   * wuerde Obsidian beim Speichern eines Schalters den Cache überschreiben.
   */
  getControlValue(key: string): unknown {
    return this.plugin.settings[key as keyof MoiSettings];
  }

  setControlValue(key: string, value: unknown): void {
    const k = key as keyof MoiSettings;
    if (k === "iconFolder") {
      this.plugin.settings.iconFolder =
        normalizeFolder(String(value)) || DEFAULT_SETTINGS.iconFolder;
      this.plugin.saveSettingsSoon();
      return;
    }
    if (k === "mappingFile") {
      this.plugin.settings.mappingFile =
        normalizeFolder(String(value)) || DEFAULT_SETTINGS.mappingFile;
      this.plugin.saveSettingsSoon();
      return;
    }
    // Nur die Schalter, keine fremden Schluessel annehmen.
    if (typeof value === "boolean" && isBooleanSettingKey(k)) {
      this.plugin.settings[k] = value;
      void this.plugin.saveSettings();
    }
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    let newExt = "";
    return [
      {
        // Name und Slogan kommen beide aus Obsidian. Ein eigener render
        // waere doppelt: der Framework malt name und desc selbst, der eigene
        // Kopf stand dadurch zweimal da.
        name: "My Own Icons",
        desc: slogan(),
        searchable: false,
      },
      {
        name: t("set.iconFolder.name"),
        desc: t("set.iconFolder.desc"),
        aliases: ["svg", "icon"],
        control: {
          type: "text",
          key: "iconFolder",
          placeholder: "_assets/icons",
        },
      },
      {
        name: t("set.mappingFile.name"),
        desc: t("set.mappingFile.desc"),
        aliases: ["json"],
        control: {
          type: "text",
          key: "mappingFile",
          placeholder: "_assets/icon-mapping.json",
        },
      },
      {
        name: t("set.ext.name"),
        desc: t("set.ext.desc"),
        aliases: ["extension", "dateiendung"],
      },
      ...this.plugin
        .iconMapping()
        .extEntries()
        .map(([ext, entry]) => ({
          name: `*.${ext}`,
          desc: entry.icon,
          render: (setting: Setting) => {
            const preview = createSpan();
            preview.addClass("obsidian-icon-inline");
            preview.setCssStyles({ width: "18px", height: "18px" });
            setting.settingEl.prepend(preview);
            const ref = parseIconRef(entry.icon);
            if (ref) {
              void renderIconInto(preview, ref, this.plugin.iconStore(), {
                color: entry.color,
              });
            }
            setting
              .addButton((button) =>
                button.setButtonText(t("set.ext.change")).onClick(() => {
                  this.plugin.openExtPicker(
                    ext,
                    {
                      icon: entry.icon,
                      ...(entry.color ? { color: entry.color } : {}),
                      ...(entry.size ? { size: entry.size } : {}),
                      ...(entry.iconDark ? { iconDark: entry.iconDark } : {}),
                    },
                    () => this.update(),
                  );
                }),
              )
              .addButton((button) =>
                button.setButtonText("✕").onClick(async () => {
                  await this.plugin.iconMapping().removeExt(ext);
                  this.plugin.refreshViews();
                  this.update();
                }),
              );
          },
        })),
      {
        name: t("set.ext.add.name"),
        desc: t("set.ext.add.desc"),
        render: (setting: Setting) => {
          setting
            .addText((text) =>
              text.setPlaceholder("md").onChange((value) => {
                newExt = value;
              }),
            )
            .addButton((button) =>
              button.setButtonText(t("set.ext.pick")).onClick(() => {
                const ext = normalizeExt(newExt);
                if (!ext) {
                  new Notice(t("notice.invalidExt"));
                  return;
                }
                this.plugin.openExtPicker(
                  ext,
                  this.plugin.iconMapping().getExt(ext),
                  () => this.update(),
                );
              }),
            );
        },
      },
      {
        name: t("set.cdn.name"),
        desc: t("set.cdn.desc"),
        aliases: ["jsdelivr", "internet"],
        control: { type: "toggle", key: "cdnEnabled" },
      },
      {
        name: t("set.selfhost.name"),
        desc: t("set.selfhost.desc"),
        aliases: ["selfh.st", "homelab"],
        control: { type: "toggle", key: "selfhostEnabled" },
      },
      {
        name: t("set.saveOnPick.name"),
        desc: t("set.saveOnPick.desc"),
        aliases: ["offline", "svg"],
        control: { type: "toggle", key: "saveFilesOnApply" },
      },
      {
        name: t("set.stand.name"),
        desc: this.plugin.catalogStandText(),
        aliases: ["catalog", "index"],
        render: (setting: Setting) => {
          setting.settingEl.empty();
          setting.addButton((button) =>
            button.setButtonText(t("set.stand.reload")).onClick(async () => {
              await this.plugin.reloadCatalogs();
              this.update();
            }),
          );
        },
      },
      {
        name: t("set.cache.name"),
        desc: t("set.cache.count", { count: this.plugin.cacheSize() }),
        aliases: ["cache", "cdn"],
        render: (setting: Setting) => {
          setting.settingEl.empty();
          setting.addButton((button) =>
            button.setButtonText(t("set.cache.clear")).onClick(() => {
              this.plugin.clearCache();
              this.update();
            }),
          );
        },
      },
      {
        name: t("set.saveAll.name"),
        desc: t("set.saveAll.desc"),
        aliases: ["offline", "svg", "migration"],
        action: () => {
          void this.plugin.saveAllIconFiles().then((result) => {
            if (!result) return;
            new Notice(t("notice.saveAllDone", result));
            this.update();
          });
        },
      },
      {
        name: t("set.autoLight.name"),
        desc: t("set.autoLight.desc"),
        aliases: ["dark", "theme"],
        control: { type: "toggle", key: "autoLightVariant" },
      },
      {
        name: t("set.tabs.name"),
        desc: t("set.tabs.desc"),
        control: { type: "toggle", key: "showTabIcons" },
      },
      {
        name: t("set.titles.name"),
        desc: t("set.titles.desc"),
        aliases: ["inline title"],
        control: { type: "toggle", key: "showTitleIcons" },
      },
      {
        name: t("set.export.name"),
        desc: t("set.export.desc"),
        aliases: ["backup", "json"],
        action: () => {
          void exportIcons(
            this.plugin.app,
            this.plugin.iconStore(),
            this.plugin.iconMapping(),
          );
        },
      },
      {
        name: t("set.import.name"),
        desc: t("set.import.desc"),
        aliases: ["restore", "json"],
        action: () => {
          this.plugin.importPackage();
        },
      },
    ];
  }
}
