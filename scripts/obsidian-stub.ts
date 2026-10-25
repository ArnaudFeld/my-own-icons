/** Minimaler obsidian Ersatz nur für die Node Tests, nie im Plugin. */
export class StubVault {
  files = new Map<string, string>();
  folders = new Set<string>();

  getAbstractFileByPath(path: string): TFile | TFolder | null {
    if (this.files.has(path)) return this.asFile(path);
    if (this.folders.has(path)) {
      const folder = new TFolder();
      folder.path = path;
      return folder;
    }
    return null;
  }

  /** Wie im echten Vault: Elternordner muss stehen, doppelt wirft. */
  async createFolder(path: string): Promise<void> {
    const slash = path.lastIndexOf("/");
    if (slash > 0 && !this.folders.has(path.slice(0, slash))) {
      throw new Error(`Elternordner fehlt: ${path}`);
    }
    if (this.folders.has(path) || this.files.has(path)) {
      throw new Error(`existiert: ${path}`);
    }
    this.folders.add(path);
  }

  getMarkdownFiles(): TFile[] {
    return [...this.files.keys()]
      .filter((path) => path.toLowerCase().endsWith(".md"))
      .map((path) => this.asFile(path));
  }

  async cachedRead(file: TFile): Promise<string> {
    const content = this.files.get(file.path);
    if (content === undefined) throw new Error(`fehlend: ${file.path}`);
    return content;
  }

  getFiles(): TFile[] {
    return [...this.files.keys()].map((path) => this.asFile(path));
  }

  /**
   * Ordner aus den bekannten Pfaden ableiten. Echtes Obsidian liefert die
   * Hierarchie, im Stub wird sie aus den Dateipfaden gebaut, damit
   * listSvgNames ohne echten Vault getestet werden kann.
   */
  getFolderByPath(path: string): TFolder | null {
    const prefix = path === "" ? "" : path + "/";
    const folder = new TFolder();
    folder.path = path;
    const subdirs = new Set<string>();
    let found = false;
    for (const file of this.files.keys()) {
      if (!file.startsWith(prefix)) continue;
      const rest = file.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash < 0) {
        folder.children.push(this.asFile(file));
      } else {
        subdirs.add(prefix + rest.slice(0, slash));
      }
      found = true;
    }
    if (!found) return null;
    for (const sub of subdirs) {
      const child = new TFolder();
      child.path = sub;
      const deeper = this.getFolderByPath(sub);
      child.children = deeper ? deeper.children : [];
      folder.children.push(child);
    }
    return folder;
  }

  private asFile(path: string): TFile {
    const file = new TFile();
    file.path = path;
    const dot = path.lastIndexOf(".");
    file.extension = dot >= 0 ? path.slice(dot + 1) : "";
    return file;
  }

  async read(file: TFile): Promise<string> {
    const content = this.files.get(file.path);
    if (content === undefined) throw new Error(`fehlend: ${file.path}`);
    return content;
  }

  async modify(file: TFile, content: string): Promise<void> {
    this.files.set(file.path, content);
  }

  async create(path: string, content: string): Promise<TFile> {
    this.files.set(path, content);
    return this.getAbstractFileByPath(path) as TFile;
  }

  adapter = {
    mkdir: async (_dir: string): Promise<void> => {},
  };
}

export class App {
  vault = new StubVault();
}

export class TAbstractFile {
  path = "";
}

export class TFile extends TAbstractFile {
  extension = "";
}

export class TFolder extends TAbstractFile {
  children: (TFile | TFolder)[] = [];
}

export class WorkspaceLeaf {}

export class Modal {
  app: App;
  constructor(app: App) {
    this.app = app;
  }
}

export class EditorSuggest<T> {
  app: App;
  limit = 0;
  context: null = null;
  constructor(app: App) {
    this.app = app;
  }
}

export function getIconIds(): string[] {
  return [];
}

export function setIcon(): void {}

let stubLanguage = "en";

export function getLanguage(): string {
  return stubLanguage;
}

/** Nur für Tests: Sprache der App umstellen. */
export function setStubLanguage(lang: string): void {
  stubLanguage = lang;
}

export async function requestUrl(args: {
  url: string;
}): Promise<{ status: number; text: string }> {
  stubFetchUrls.push(args.url);
  return stubFetch(args.url);
}

type StubFetch = (url: string) => Promise<{ status: number; text: string }>;

const offlineFetch: StubFetch = async () => {
  throw new Error("obsidian-stub: kein Netz in Tests");
};

let stubFetch: StubFetch = offlineFetch;
let stubFetchUrls: string[] = [];

/** Nur für Tests: Netzverhalten vorgeben, Zähler und Liste zurücksetzen. */
export function setStubFetch(fn: StubFetch): void {
  stubFetch = fn;
  stubFetchUrls = [];
}

/** Nur für Tests: zurückgesetztes Netz, etwa für den nächsten Test. */
export function resetStubFetch(): void {
  stubFetch = offlineFetch;
  stubFetchUrls = [];
}

/** Nur für Tests: wie viele requestUrl Aufrufe seit dem Zurücksetzen. */
export function stubFetchCalls(): { count: number; urls: string[] } {
  return { count: stubFetchUrls.length, urls: [...stubFetchUrls] };
}

// Der CDN Cache nutzt window.setTimeout für das Speichern, in Node gibt es
// kein window. Nur ergänzen, wenn die Laufzeit keins mitbringt.
const globalAny = globalThis as unknown as { window?: unknown };
if (typeof globalAny.window === "undefined") {
  globalAny.window = {
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (handle: unknown) => clearTimeout(handle as never),
  };
}

export class Notice {
  constructor(_message?: unknown, _timeout?: number) {}
  hide(): void {}
}
