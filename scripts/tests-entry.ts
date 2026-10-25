import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeFolder,
  normalizeSvgName,
  parseIconRef,
  parseSize,
  sanitizeSvg,
} from "../icons";
import { MappingStore, normalizeEntry, normalizeExt } from "../mapping";
import type { IconMapping } from "../mapping";
import { collectImportEntries, freeExportName } from "../exchange";
import {
  currentLanguage,
  slogan,
  colorName,
  t,
  missingTranslations,
} from "../i18n";
import { badgeKey, isBadgeMutation } from "../explorer";
import { unusedSvgNames } from "../gallery";
import { ensureFolder, writeSvgFile } from "../file-save";
import { refsInText } from "../shortcodes";
import {
  setStubLanguage,
  setStubFetch,
  resetStubFetch,
  stubFetchCalls,
} from "./obsidian-stub";
import type { App as ObsidianApp } from "obsidian";
import { pickVariant } from "../tabs-titles";
import {
  CdnCache,
  MISSING_TTL_MS,
  catalogStand,
  clearCatalogCaches,
  loadCatalogs,
  selfhostLightRefs,
} from "../cdn";
import { DEFAULT_SETTINGS, readSettings } from "../settings";
import {
  insideCode,
  insideInlineCode,
  isFenceLine,
  type LineSource,
} from "../code-context";
import { cachedCatalogRefs } from "../suggest";
import { IconStore } from "../icons";
import { App } from "./obsidian-stub";

let count = 0;

function check(name: string, fn: () => void): void {
  fn();
  count++;
  console.log(`ok ${count} - ${name}`);
}

async function checkAsync(
  name: string,
  fn: () => Promise<void>,
): Promise<void> {
  await fn();
  count++;
  console.log(`ok ${count} - ${name}`);
}

check("Datei ohne Ordner", () => {
  assert.deepEqual(parseIconRef("server"), { kind: "svg", name: "server" });
});

check("Datei mit Ordner und Endung", () => {
  assert.deepEqual(parseIconRef("devicon/proxmox.svg"), {
    kind: "svg",
    name: "devicon/proxmox",
  });
});

check("Führende Schrägstriche fallen weg", () => {
  assert.deepEqual(parseIconRef("/custom/logo"), {
    kind: "svg",
    name: "custom/logo",
  });
});

check("Pfad Tricks sind null", () => {
  assert.equal(parseIconRef(""), null);
  assert.equal(parseIconRef("../x"), null);
  assert.equal(parseIconRef("a b"), null);
});

check("Lucide Form", () => {
  assert.deepEqual(parseIconRef("lucide:folder"), {
    kind: "lucide",
    id: "folder",
  });
  assert.equal(parseIconRef("lucide:"), null);
  assert.equal(parseIconRef("lucide:a b"), null);
});

check("Emoji Form", () => {
  assert.deepEqual(parseIconRef("emoji:📁"), { kind: "emoji", char: "📁" });
  assert.equal(parseIconRef("emoji:"), null);
});

check("SVG Name Norm", () => {
  assert.equal(normalizeSvgName("x.svg"), "x");
  assert.equal(normalizeSvgName(".."), null);
});

check("Größe Norm", () => {
  assert.equal(parseSize("24"), "24px");
  assert.equal(parseSize("1.5em"), "1.5em");
  assert.equal(parseSize("red"), undefined);
  assert.equal(parseSize(""), undefined);
});

check("Eintrag Kurzform", () => {
  assert.deepEqual(normalizeEntry(" devicon/x "), { icon: "devicon/x" });
  assert.equal(normalizeEntry("  "), null);
  assert.equal(normalizeEntry(undefined), null);
});

check("Eintrag Langform wird geputzt", () => {
  assert.deepEqual(
    normalizeEntry({
      icon: " a ",
      color: " red ",
      size: "24",
      iconDark: "lucide:folder",
    }),
    { icon: "a", color: "red", size: "24px", iconDark: "lucide:folder" },
  );
});

check("Eintrag wirft Ungültiges weg", () => {
  assert.deepEqual(normalizeEntry({ icon: "a", size: "rot", iconDark: ".." }), {
    icon: "a",
  });
});

check("Eintrag mit Zahl Werten stürzt nicht ab", () => {
  assert.deepEqual(
    normalizeEntry({
      icon: "a",
      size: 24 as unknown as string,
      color: 5 as unknown as string,
    }),
    { icon: "a" },
  );
});

check("Endung Norm", () => {
  assert.equal(normalizeExt("MD"), "md");
  assert.equal(normalizeExt(".md"), "md");
  assert.equal(normalizeExt("m d"), null);
  assert.equal(normalizeExt(""), null);
});

check("Variante hell bleibt", () => {
  assert.deepEqual(
    pickVariant({ icon: "a", color: "red", size: "16px" }, false),
    { icon: "a", color: "red", size: "16px" },
  );
});

check("Variante dunkel per Hand gewinnt", () => {
  assert.deepEqual(
    pickVariant({ icon: "a", iconDark: "lucide:folder" }, true),
    { icon: "lucide:folder" },
  );
});

check("Variante dunkel ungültig fällt zurück", () => {
  assert.deepEqual(pickVariant({ icon: "a", iconDark: ".." }, true), {
    icon: "a",
  });
});

check("Variante Self-Hosted hell automatisch", () => {
  const hasLight = (ref: string): boolean => ref === "technitium";
  assert.deepEqual(
    pickVariant({ icon: "selfhosted/technitium" }, true, hasLight, true),
    { icon: "selfhosted/technitium-light" },
  );
  assert.deepEqual(
    pickVariant({ icon: "selfhosted/technitium" }, true, hasLight, false),
    { icon: "selfhosted/technitium" },
  );
  assert.deepEqual(
    pickVariant({ icon: "selfhosted/anderes" }, true, hasLight, true),
    { icon: "selfhosted/anderes" },
  );
});

check("Sanitizer behält Harmloses", () => {
  const svg = '<svg viewBox="0 0 10 10"><path fill="red"/></svg>';
  assert.equal(sanitizeSvg(svg), svg);
});

check("Sanitizer entfernt Skript und Handler", () => {
  const out = sanitizeSvg(
    '<svg><script>alert(1)</script><path onload="x()" fill="red"/></svg>',
  );
  assert.ok(!out.includes("<script"));
  assert.ok(!out.includes("onload"));
  assert.ok(out.includes('fill="red"'));
});

check("Sanitizer entfernt Fremdkörper und Skript Adressen", () => {
  const out = sanitizeSvg(
    '<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">x</body></foreignObject><a href="javascript:alert(1)">y</a></svg>',
  );
  assert.ok(!out.toLowerCase().includes("foreignobject"));
  assert.ok(!out.includes("javascript:"));
});

check("Sanitizer ohne Anführungszeichen und Rahmen", () => {
  const out = sanitizeSvg(
    '<svg onload=alert(1)><img src=x onerror=alert(2)><iframe src="data:text/html,x"></iframe></svg>',
  );
  assert.ok(!out.includes("onload"));
  assert.ok(!out.includes("onerror"));
  assert.ok(!out.toLowerCase().includes("iframe"));
});

check("Sanitizer kodierte Adressen und Stil Import", () => {
  const out = sanitizeSvg(
    "<svg><a xlink:href=\"&#106;avascript:alert(1)\"><text>x</text></a><style>@import 'https://evil/x.css';.a{fill:red}</style></svg>",
  );
  assert.ok(!out.includes("xlink:href"));
  assert.ok(!out.includes("@import"));
  assert.ok(out.includes(".a{fill:red}"));
});

check("Sanitizer behält Verlauf und interne Verweise", () => {
  const svg =
    '<svg><defs><linearGradient id="g"></linearGradient></defs><path fill="url(#g)"/><use href="#x"/></svg>';
  const out = sanitizeSvg(svg);
  assert.ok(out.includes('fill="url(#g)"'));
  assert.ok(out.includes('href="#x"'));
});

check("Sanitizer Trenner Schrägstrich und Anführungszeichen", () => {
  const out = sanitizeSvg(
    '<svg/onload=alert(1)><animate/onbegin=alert(2) attributeName=x dur=1s/><a href="#"onload=alert(3)><text>k</text></a></svg>',
  );
  assert.ok(!out.includes("onload"));
  assert.ok(!out.includes("onbegin"));
  assert.ok(out.includes("<text>k</text>"));
});

check("Sanitizer SMIL-Werte und benannte Entities", () => {
  const out = sanitizeSvg(
    '<svg><a href="#ok"><text>x</text><animate attributeName="href" values="&#106;avascript:alert(1)" dur="1s"/></a>' +
      '<a href="#x"><text>k</text><animate attributeName="href" from="#" to="javascript&colon;alert(1)" dur="1s"/></a></svg>',
  );
  assert.ok(!out.includes("values="));
  assert.ok(!out.includes("javascript:"));
  assert.ok(out.includes("<text>x</text>"));
});

check("Sanitizer Stil-Attribut und srcset", () => {
  const out = sanitizeSvg(
    '<svg><circle style="fill:red;background:url(http://evil/?c=1)"/><image srcset="http://evil/x.svg 1x"/></svg>',
  );
  assert.ok(!out.includes("http://evil"));
  assert.ok(out.includes("fill:red"));
  assert.ok(!out.includes("srcset"));
});

check("Sanitizer Skript mit Quelle ohne Close", () => {
  const out = sanitizeSvg(
    '<svg><script href="data:text/javascript,alert(1)"/><circle fill="red"/></svg>',
  );
  assert.ok(!out.includes("<script"));
  assert.ok(out.includes('fill="red"'));
});
check("Sanitizer offenes Fremdobjekt und to Schema", () => {
  const out = sanitizeSvg(
    '<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror=alert(1)>',
  );
  assert.ok(!out.toLowerCase().includes("foreignobject"));
  assert.ok(!out.includes("onerror"));
  const anim = sanitizeSvg(
    '<svg><animate attributeName="x" to="100"/><set attributeName="href" to="javascript:alert(1)"/></svg>',
  );
  assert.ok(anim.includes('to="100"'));
  assert.ok(!anim.includes("javascript:"));
});

check("Sanitizer verwirft HTML nach Root SVG", () => {
  const out = sanitizeSvg(
    '<svg width="20" height="20"><rect/></svg><div>evil</div>',
  );
  assert.ok(!out.includes("<div>"));
  assert.ok(out.includes("<svg"));
});

check("Sanitizer externe Paint URLs", () => {
  const out = sanitizeSvg(
    '<svg><rect fill="url(http://evil/x#f)" filter="url(//evil/f)"/><path fill="url(#g)"/></svg>',
  );
  assert.ok(!out.includes("http://evil"));
  assert.ok(!out.includes("//evil"));
  assert.ok(out.includes('fill="url(#g)"'));
});

check("Sanitizer kodiertes Stil URL", () => {
  const out = sanitizeSvg(
    '<svg><circle style="background:url&#40;http://evil/x&#41;"/></svg>',
  );
  assert.ok(!out.includes("http://evil"));
});

check("Sanitizer CSS Escape URL", () => {
  const out = sanitizeSvg(
    '<svg><circle style="fill:\\75rl(http://evil/x)"/></svg>',
  );
  assert.ok(!out.includes("http://evil"));
});

check("Sanitizer SMIL Event Attribute", () => {
  const out = sanitizeSvg(
    '<svg><set attributeName="onload" to="x"/><animate attributeName="x" to="100"/></svg>',
  );
  assert.ok(!out.toLowerCase().includes("onload"));
  assert.ok(out.includes('to="100"'));
});

check("Sanitizer ungeschlossenes Stil", () => {
  const out = sanitizeSvg(
    '<svg><style>rect{fill:url(http://evil/x)}<rect fill="red"/></svg>',
  );
  assert.ok(!out.includes("http://evil"));
});

check("Ordner Norm wirft Punkte raus", () => {
  assert.equal(normalizeFolder("_assets/icons"), "_assets/icons");
  assert.equal(normalizeFolder("/a//b/"), "a/b");
  assert.equal(normalizeFolder("../../x"), "x");
  assert.equal(normalizeFolder("a/./b"), "a/b");
});

console.log(`# ${count} Tests bestanden`);

function testApp(): App {
  return new App();
}

function testStore(app: App): MappingStore {
  return new MappingStore(
    app as unknown as import("obsidian").App,
    () => "_assets/icon-mapping.json",
  );
}

await checkAsync("Parallele Saves verlieren nichts", async () => {
  const app = testApp();
  const store = testStore(app);
  await Promise.all([
    store.setMany([
      ["a.md", { icon: "eins" }],
      ["b.md", { icon: "zwei" }],
    ]),
    store.set("c.md", { icon: "drei" }),
  ]);
  const raw = app.vault.files.get("_assets/icon-mapping.json") ?? "";
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.deepEqual(parsed["a.md"], "eins");
  assert.deepEqual(parsed["b.md"], "zwei");
  assert.deepEqual(parsed["c.md"], "drei");
});

await checkAsync("Kaputte Datei behält Stand", async () => {
  const app = testApp();
  const store = testStore(app);
  await store.set("a.md", { icon: "eins" });
  app.vault.files.set("_assets/icon-mapping.json", "{kaputt");
  await store.load();
  assert.deepEqual(store.get("a.md"), { icon: "eins" });
});

await checkAsync("Endung groß wird klein", async () => {
  const app = testApp();
  const store = testStore(app);
  await store.setExt("MD", { icon: "server" });
  assert.deepEqual(store.getExt("md"), { icon: "server" });
  assert.deepEqual(store.getExt("MD"), { icon: "server" });
  const raw = app.vault.files.get("_assets/icon-mapping.json") ?? "";
  assert.ok(raw.includes('"md"'));
  assert.ok(!raw.includes('"MD"'));
  await store.removeExt("MD");
  assert.equal(store.getExt("md"), null);
});

await checkAsync("Alte große Endung heilt beim Laden", async () => {
  const app = testApp();
  app.vault.files.set(
    "_assets/icon-mapping.json",
    JSON.stringify({ __ext__: { MD: "server" } }),
  );
  const store = testStore(app);
  await store.load();
  assert.deepEqual(store.getExt("md"), { icon: "server" });
});

await checkAsync("Entfernen findet jede Schreibweise", async () => {
  const app = testApp();
  app.vault.files.set(
    "_assets/icon-mapping.json",
    JSON.stringify({ __ext__: { MD: "server" } }),
  );
  const store = testStore(app);
  await store.load();
  await store.removeExt(".MD");
  assert.equal(store.getExt("md"), null);
});

await checkAsync("CDN Fehlschlag versucht neu nach TTL", async () => {
  const cache = new CdnCache({ load: () => ({}), save: () => {} });
  const realNow = Date.now;
  try {
    Date.now = () => 1_000_000;
    assert.equal(await cache.getSvg("devicon/xyz"), null);
    assert.equal(
      (cache as unknown as { missing: Map<string, number> }).missing.get(
        "devicon/xyz",
      ),
      1_000_000,
    );
    assert.equal(await cache.getSvg("devicon/xyz"), null);
    assert.equal(
      (cache as unknown as { missing: Map<string, number> }).missing.get(
        "devicon/xyz",
      ),
      1_000_000,
    );
    Date.now = () => 1_000_000 + MISSING_TTL_MS + 1;
    assert.equal(await cache.getSvg("devicon/xyz"), null);
    assert.equal(
      (cache as unknown as { missing: Map<string, number> }).missing.get(
        "devicon/xyz",
      ),
      1_000_000 + MISSING_TTL_MS + 1,
    );
  } finally {
    Date.now = realNow;
  }
});

console.log(`# ${count} Tests bestanden (mit async)`);

await checkAsync("Cache aus data.json wird sanitiert", async () => {
  const cache = new CdnCache({
    load: () => ({
      "devicon/x": '<svg onload=alert(1)><path fill="red"/></svg>',
    }),
    save: () => {},
  });
  const svg = cache.peek("devicon/x") ?? "";
  assert.ok(!svg.includes("onload"));
  assert.ok(svg.includes('fill="red"'));
});

await checkAsync("Cache aus data.json bleibt gedeckelt", async () => {
  const data: Record<string, string> = {};
  for (let i = 0; i < 200; i++) {
    data[`devicon/n${i}`] = "<svg><path/></svg>";
  }
  const cache = new CdnCache({ load: () => data, save: () => {} });
  assert.ok(cache.size <= 150);
});

await checkAsync("Proto Schlüssel landen nicht im Speicher", async () => {
  const app = testApp();
  const store = testStore(app);
  await store.set("__proto__", { icon: "x" });
  await store.setMany([["constructor", { icon: "x" }]]);
  await store.setExt("__proto__", { icon: "x" });
  assert.deepEqual(store.entries(), []);
  assert.deepEqual(store.extEntries(), []);
  assert.equal(({} as Record<string, unknown>)["icon" as string], undefined);
});

await checkAsync("Suggest Katalog kommt aus dem Cache", async () => {
  const app = testApp();
  app.vault.files.set("_assets/icons/server.svg", "<svg/>");
  const store = new IconStore(
    app as unknown as import("obsidian").App,
    () => "_assets/icons",
  );
  const first = await cachedCatalogRefs(store, { cdn: false, selfhost: false });
  assert.ok(first.catalog.refs.includes("server"));
  assert.deepEqual(first.hay.get("server"), ["server"]);
  const second = await cachedCatalogRefs(store, {
    cdn: false,
    selfhost: false,
  });
  assert.equal(second, first);
});

await checkAsync("Import-Batch schreibt alles auf einmal", async () => {
  const app = testApp();
  const store = testStore(app);
  let writes = 0;
  const origCreate = app.vault.create.bind(app.vault);
  const origModify = app.vault.modify.bind(app.vault);
  app.vault.create = async (path: string, content: string) => {
    writes++;
    return origCreate(path, content);
  };
  app.vault.modify = async (file: never, content: string) => {
    writes++;
    return origModify(file, content);
  };
  await store.importAll(
    [
      ["a.md", { icon: "eins" }],
      ["b.md", { icon: "zwei" }],
    ],
    [["md", { icon: "server" }]],
  );
  assert.equal(writes, 1);
  assert.deepEqual(store.get("a.md"), { icon: "eins" });
  assert.deepEqual(store.getExt("md"), { icon: "server" });
});

await checkAsync("Set während Load geht nicht verloren", async () => {
  const app = testApp();
  const store = testStore(app);
  await store.set("a.md", { icon: "eins" });
  await Promise.all([store.load(), store.set("b.md", { icon: "zwei" })]);
  assert.deepEqual(store.get("a.md"), { icon: "eins" });
  assert.deepEqual(store.get("b.md"), { icon: "zwei" });
  const raw = app.vault.files.get("_assets/icon-mapping.json") ?? "";
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.deepEqual(parsed["a.md"], "eins");
  assert.deepEqual(parsed["b.md"], "zwei");
});

await checkAsync("removePath löscht Datei und Ordner Kinder", async () => {
  const app = testApp();
  const store = testStore(app);
  await store.setMany([
    ["ordner/a.md", { icon: "eins" }],
    ["ordner/b.md", { icon: "zwei" }],
    ["anders.md", { icon: "drei" }],
  ]);
  assert.equal(await store.removePath("ordner", true), true);
  assert.equal(store.get("ordner/a.md"), null);
  assert.equal(store.get("ordner/b.md"), null);
  assert.deepEqual(store.get("anders.md"), { icon: "drei" });
  assert.equal(await store.removePath("nix.md", false), false);
  assert.equal(await store.removePath("anders.md", false), true);
  assert.equal(store.get("anders.md"), null);
});

await checkAsync("migrateRename zieht Kinder mit um", async () => {
  const app = testApp();
  const store = testStore(app);
  await store.setMany([
    ["alt/a.md", { icon: "eins" }],
    ["solo.md", { icon: "zwei" }],
  ]);
  assert.equal(await store.migrateRename("alt", "neu", true), true);
  assert.deepEqual(store.get("neu/a.md"), { icon: "eins" });
  assert.equal(store.get("alt/a.md"), null);
  assert.deepEqual(store.get("solo.md"), { icon: "zwei" });
});

await checkAsync("Reservierter Schlüssel bleibt unangetastet", async () => {
  const app = testApp();
  const store = testStore(app);
  await store.set("__ext__", { icon: "x" });
  await store.setMany([["__ext__", { icon: "x" }]]);
  await store.remove("__ext__");
  await store.setExt("__ext__", { icon: "x" });
  assert.deepEqual(store.entries(), []);
  assert.deepEqual(store.extEntries(), []);
  assert.equal(app.vault.files.get("_assets/icon-mapping.json"), undefined);
});

await checkAsync("Proto Namen lösen keinen Schreibvorgang aus", async () => {
  const app = testApp();
  const store = testStore(app);
  let writes = 0;
  const origCreate = app.vault.create.bind(app.vault);
  const origModify = app.vault.modify.bind(app.vault);
  app.vault.create = async (path: string, content: string) => {
    writes++;
    return origCreate(path, content);
  };
  app.vault.modify = async (file: never, content: string) => {
    writes++;
    return origModify(file, content);
  };
  await store.set("a.md", { icon: "eins" });
  assert.equal(writes, 1);
  await store.remove("toString");
  await store.removeMany(["valueOf"]);
  assert.equal(writes, 1);
});

await checkAsync("Import sammelt nur gültige Einträge", async () => {
  const pkg = {
    "a.md": "eins",
    "a..b.md": "zwei",
    "../x.md": "böse",
    "": "leer",
    "/abs.md": "abs",
    "kaputt.md": { icon: "../x" },
    __ext__: { md: "server", BÖSE: "x" },
  } as unknown as IconMapping;
  const res = collectImportEntries(pkg, 5000);
  assert.deepEqual(res.pathItems.map(([p]) => p).sort(), ["a..b.md", "a.md"]);
  assert.deepEqual(res.extItems, [["md", { icon: "server" }]]);
  assert.equal(res.entries, 3);
  assert.equal(res.skipped, 5);
});

await checkAsync("Import deckelt Einträge", async () => {
  const mapping: Record<string, string> = {};
  for (let i = 0; i < 10; i++) mapping[`f${i}.md`] = "x";
  const res = collectImportEntries(mapping as IconMapping, 3);
  assert.equal(res.entries, 3);
  assert.equal(res.pathItems.length, 3);
  assert.equal(res.skipped, 7);
});

check("Slogan folgt der App Sprache", () => {
  setStubLanguage("de-AT");
  assert.equal(currentLanguage(), "de");
  assert.equal(slogan(), "Lokal, leicht, deins.");
  setStubLanguage("fr");
  assert.equal(slogan(), "Local, léger, à vous.");
  setStubLanguage("es");
  assert.equal(slogan(), "Local, ligero, tuyo.");
  setStubLanguage("it");
  assert.equal(slogan(), "Local, lightweight, yours.");
  setStubLanguage("en");
  assert.equal(currentLanguage(), "en");
  assert.equal(slogan(), "Local, lightweight, yours.");
});

check("UI Texte zweisprachig mit Platzhaltern", () => {
  setStubLanguage("de");
  assert.equal(t("menu.change"), "Icon ändern");
  assert.equal(t("pick.apply"), "Übernehmen");
  assert.equal(colorName("green"), "Grün");
  setStubLanguage("en");
  assert.equal(t("menu.change"), "Change icon");
  assert.equal(t("pick.apply"), "Apply");
  assert.equal(colorName("green"), "Green");
  assert.equal(t("notice.saved", { path: "a.svg" }), "Saved: a.svg");
  assert.equal(t("set.cache.count", { count: 3 }), "3 icons on this device.");
  setStubLanguage("it");
  assert.equal(t("menu.change"), "Change icon");
  setStubLanguage("en");
});

check("Keine fehlenden Übersetzungen", () => {
  assert.deepEqual(missingTranslations(), []);
});

check("UI Texte in vier Sprachen", () => {
  setStubLanguage("fr");
  assert.equal(t("menu.change"), "Changer l'icône");
  assert.equal(t("pick.apply"), "Appliquer");
  setStubLanguage("es");
  assert.equal(t("menu.change"), "Cambiar icono");
  assert.equal(t("pick.apply"), "Aplicar");
  setStubLanguage("it");
  assert.equal(t("menu.change"), "Change icon");
  setStubLanguage("en");
  assert.equal(t("pick.colorDefault"), "Default");
});

check("Explorer Badge Schlüssel", () => {
  assert.equal(badgeKey(false, "server"), "light|server||");
  assert.equal(badgeKey(true, "server", "red", "20"), "dark|server|red|20");
});

check("Explorer erkennt eigene Badge Mutationen", () => {
  const badge = {
    closest: (sel: string) =>
      sel === ".obsidian-icon-explorer" ? ({} as Element) : null,
  };
  const other = { closest: () => null };
  const asRecord = (target: unknown): MutationRecord =>
    ({ target }) as unknown as MutationRecord;
  assert.equal(isBadgeMutation([asRecord(badge)]), true);
  assert.equal(isBadgeMutation([asRecord(other)]), false);
  assert.equal(isBadgeMutation([asRecord(badge), asRecord(other)]), false);
});

check("Galerie findet ungenutzte Dateien", () => {
  const entries = [
    { icon: "server" },
    { icon: "lucide:folder", iconDark: "router" },
  ];
  assert.deepEqual(unusedSvgNames(["server", "router", "db"], entries), ["db"]);
  assert.deepEqual(unusedSvgNames([], entries), []);
});

check("Einstellungen übernehmen gültige Werte", () => {
  const out = readSettings({
    iconFolder: "icons",
    mappingFile: "map.json",
    cdnEnabled: true,
    selfhostEnabled: true,
    autoLightVariant: false,
    showTabIcons: false,
    showTitleIcons: false,
  });
  assert.deepEqual(out, {
    iconFolder: "icons",
    mappingFile: "map.json",
    cdnEnabled: true,
    selfhostEnabled: true,
    saveFilesOnApply: true,
    autoLightVariant: false,
    showTabIcons: false,
    showTitleIcons: false,
  });
});

check("Einstellungen fallen bei falschem Typ auf den Standard", () => {
  // Number im Pfadfeld würde die Icon Suche mit TypeError abbrechen.
  const out = readSettings({
    iconFolder: 42,
    mappingFile: ["a"],
    cdnEnabled: "true",
  });
  assert.equal(out.iconFolder, DEFAULT_SETTINGS.iconFolder);
  assert.equal(out.mappingFile, DEFAULT_SETTINGS.mappingFile);
  assert.equal(out.cdnEnabled, DEFAULT_SETTINGS.cdnEnabled);
  assert.equal(out.showTitleIcons, DEFAULT_SETTINGS.showTitleIcons);
});

check("Einstellungen verwerfen leere und fremde Werte", () => {
  assert.deepEqual(readSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(readSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(readSettings("kaputt"), DEFAULT_SETTINGS);
  assert.deepEqual(readSettings([1, 2]), DEFAULT_SETTINGS);
  assert.deepEqual(readSettings({ iconFolder: "   " }), DEFAULT_SETTINGS);
  // Unbekanntes Feld darf nichts in den Store schreiben.
  assert.deepEqual(
    readSettings({ cdnCache: { "devicon/x": "<svg/>" } }),
    DEFAULT_SETTINGS,
  );
});

check("Einstellungen nehmen false und leere Booleans ernst", () => {
  const out = readSettings({
    cdnEnabled: false,
    showTabs: false,
    showTabIcons: false,
  });
  assert.equal(out.cdnEnabled, false);
  assert.equal(out.showTabIcons, false);
  assert.equal(out.showTitleIcons, DEFAULT_SETTINGS.showTitleIcons);
});

await checkAsync("Parallele CDN Abrufe teilen sich eine Anfrage", async () => {
  setStubFetch(async (url) =>
    url.endsWith("-plain.svg")
      ? { status: 200, text: '<svg><path fill="red"/></svg>' }
      : { status: 404, text: "" },
  );
  try {
    const cache = new CdnCache({ load: () => ({}), save: () => {} });
    const [a, b, c] = await Promise.all([
      cache.getSvg("devicon/proxmox"),
      cache.getSvg("devicon/proxmox"),
      cache.getSvg("devicon/proxmox"),
    ]);
    assert.ok(a && a.includes("<svg"));
    assert.equal(a, b);
    assert.equal(b, c);
    // Drei parallele Zeilen, ein Request
    assert.equal(stubFetchCalls().count, 1);
    // Danach aus dem Speicher, weiterhin kein Request
    await cache.getSvg("devicon/proxmox");
    assert.equal(stubFetchCalls().count, 1);
  } finally {
    resetStubFetch();
  }
});

await checkAsync("Parallele Fehlschläge teilen sich eine Anfrage", async () => {
  setStubFetch(async () => ({ status: 404, text: "" }));
  try {
    const cache = new CdnCache({ load: () => ({}), save: () => {} });
    const results = await Promise.all([
      cache.getSvg("simple/gibtsnicht"),
      cache.getSvg("simple/gibtsnicht"),
      cache.getSvg("simple/gibtsnicht"),
    ]);
    assert.deepEqual(results, [null, null, null]);
    // simple hat nur eine URL, also ein Request trotz dreier Aufrufer
    assert.equal(stubFetchCalls().count, 1);
    const missing = (cache as unknown as { missing: Map<string, number> })
      .missing;
    assert.equal(missing.get("simple/gibtsnicht") !== undefined, true);
    // Devicon fragt plain, original und line ab: drei URLs, aber je Variante
    // nur einmal, nicht einmal je Aufrufer
    await Promise.all([
      cache.getSvg("devicon/fehlt"),
      cache.getSvg("devicon/fehlt"),
    ]);
    assert.equal(stubFetchCalls().count, 4);
  } finally {
    resetStubFetch();
  }
});

await checkAsync(
  "Parallele Vault Lesevorgänge teilen sich einen Zugriff",
  async () => {
    setStubFetch(async () => ({ status: 404, text: "" }));
    try {
      const app = new App();
      app.vault.files.set("icons/server.svg", '<svg><path fill="red"/></svg>');
      let reads = 0;
      const realRead = app.vault.read.bind(app.vault);
      app.vault.read = async (file) => {
        reads++;
        return realRead(file);
      };
      // Der Stub ist bewusst nur ein Gerüst, der echte Typ kommt daher hierher.
      const store = new IconStore(app as unknown as ObsidianApp, () => "icons");
      const [a, b, d] = await Promise.all([
        store.getSvg("server"),
        store.getSvg("server"),
        store.getSvg("server"),
      ]);
      assert.ok(a && a.includes("<svg"));
      assert.equal(a, b);
      assert.equal(b, d);
      assert.equal(reads, 1);
      await store.getSvg("server");
      assert.equal(reads, 1);
    } finally {
      resetStubFetch();
    }
  },
);

/** Live Index mit einem Light Eintrag, den der eingebaut nicht kennt. */
function fakeSelfhostIndex(): unknown[] {
  const out: unknown[] = [];
  for (let i = 0; i < 120; i++) {
    out.push({ Reference: `live-${i}`, SVG: "Yes", Light: "No", Tags: "Test" });
  }
  out.push({
    Reference: "testliveicon",
    SVG: "Yes",
    Light: "Yes",
    Tags: "Test",
  });
  return out;
}

await checkAsync(
  "Katalogstand und Light Liste fallen gemeinsam auf den eingebauten Stand",
  async () => {
    clearCatalogCaches();
    setStubFetch(async (url) => {
      if (url.includes("/selfhst/icons") && url.endsWith("index.json")) {
        return { status: 200, text: JSON.stringify(fakeSelfhostIndex()) };
      }
      return { status: 404, text: "" };
    });
    try {
      await loadCatalogs();
      assert.notEqual(catalogStand().selfhosted, null);
      assert.equal(selfhostLightRefs().has("testliveicon"), true);

      // Zweiter Lauf ohne Netz: der Live Stand darf nicht hängen bleiben
      clearCatalogCaches();
      setStubFetch(async () => ({ status: 404, text: "" }));
      await loadCatalogs();
      assert.equal(catalogStand().selfhosted, null);
      assert.equal(selfhostLightRefs().has("testliveicon"), false);
      // Der eingebaute Katalog liefert weiter seine Light Varianten
      assert.equal(selfhostLightRefs().size > 0, true);
    } finally {
      resetStubFetch();
      clearCatalogCaches();
    }
  },
);

/** Attrappe für das CodeMirror Dokument, nur die von insideCode benutzten Teile. */
function fakeDoc(text: string): LineSource {
  const rows = text.split("\n");
  let from = 0;
  const line = (n: number) => ({ number: n, text: rows[n - 1] ?? "" });
  return {
    line,
    lineAt: (pos: number) => {
      let left = pos;
      for (let n = 1; n <= rows.length; n++) {
        if (left <= (rows[n - 1] ?? "").length) {
          return { number: n, from, text: rows[n - 1] ?? "" };
        }
        left -= (rows[n - 1] ?? "").length + 1;
        from += (rows[n - 1] ?? "").length + 1;
      }
      return { number: rows.length, from, text: rows[rows.length - 1] ?? "" };
    },
  };
}

check("Blockmarke erkennt fenced Zeile, sonst nichts", () => {
  assert.equal(isFenceLine("```"), true);
  assert.equal(isFenceLine("```json"), true);
  assert.equal(isFenceLine("   ~~~"), true);
  assert.equal(isFenceLine("````"), true);
  assert.equal(isFenceLine("{{icon:x}}"), false);
  assert.equal(isFenceLine("    ```"), false);
  assert.equal(isFenceLine("text ``` more"), false);
  assert.equal(isFenceLine(""), false);
  // Backticks im Info-String machen die Zeile zum Inline-Abschnitt
  assert.equal(isFenceLine("```{{icon:x}}```"), false);
  assert.equal(isFenceLine("~~~```"), true);
});

check("Inline-Code am Backtick Lauf erkannt", () => {
  assert.equal(insideInlineCode("`{{icon:x}}`", 1), true);
  assert.equal(insideInlineCode("``{{icon:x}}``", 2), true);
  assert.equal(insideInlineCode("```{{icon:x}}```", 3), true);
  assert.equal(insideInlineCode("{{icon:x}}", 0), false);
  assert.equal(insideInlineCode("- {{icon:x}}", 2), false);
  // Abschnitt wurde vor der Position schon geschlossen
  assert.equal(insideInlineCode("`a` {{icon:x}}", 6), false);
  // Ungerade Anzahl, weil der Abschluss erst in der nächsten Zeile kommt
  assert.equal(insideInlineCode("`a {{icon:x}}", 4), true);
});

check("Echter Codeblock bleibt Text, Fliesstext nicht", () => {
  const block = "```\n{{icon:server}}\n```\n";
  assert.equal(insideCode(fakeDoc(block), block.indexOf("{{icon")), true);

  const plain = "# Titel\n\n{{icon:server}}\n";
  assert.equal(insideCode(fakeDoc(plain), plain.indexOf("{{icon")), false);

  const list = "- {{icon:server}}\n";
  assert.equal(insideCode(fakeDoc(list), list.indexOf("{{icon")), false);
});

check("Zwei Bloecke hintereinander werden getrennt", () => {
  const doc = "```\n{{icon:a}}\n```\n{{icon:b}}\n```\n{{icon:c}}\n```\n";
  assert.equal(insideCode(fakeDoc(doc), doc.indexOf("{{icon:a}}")), true);
  assert.equal(insideCode(fakeDoc(doc), doc.indexOf("{{icon:b}}")), false);
  assert.equal(insideCode(fakeDoc(doc), doc.indexOf("{{icon:c}}")), true);
});

check("Inline-Code im Editor bleibt Text", () => {
  const single = "`{{icon:server}}`\n";
  assert.equal(insideCode(fakeDoc(single), single.indexOf("{{icon")), true);

  const triple = "```{{icon:server}}```\n";
  assert.equal(insideCode(fakeDoc(triple), triple.indexOf("{{icon")), true);
});

check("Alles ausser Code wird ersetzt", () => {
  const doc =
    "## Überschrift\n\n> Zitat\n\n- Liste\n\n| a | b |\n|---|---|\n{{icon:x}}\n";
  assert.equal(insideCode(fakeDoc(doc), doc.indexOf("{{icon:x}}")), false);
});

check(
  "Inline-Abschnitt mit drei Backticks verschiebt die Zaehlung nicht",
  () => {
    // Fall aus test123.md: eine Zeile aus drei Backticks und dem Shortcode
    // darf fuer die Zeilen darunter nicht als Blockmarke gelten.
    const doc = [
      "```",
      "{{icon:a}}",
      "```",
      "`{{icon:b}}`",
      "``{{icon:c}}``",
      "{{icon:d}}",
      "```{{icon:e}}```",
      "- {{icon:f}}",
    ].join("\n");
    assert.equal(insideCode(fakeDoc(doc), doc.indexOf("{{icon:a}}")), true);
    assert.equal(insideCode(fakeDoc(doc), doc.indexOf("{{icon:b}}")), true);
    assert.equal(insideCode(fakeDoc(doc), doc.indexOf("{{icon:c}}")), true);
    assert.equal(insideCode(fakeDoc(doc), doc.indexOf("{{icon:d}}")), false);
    assert.equal(insideCode(fakeDoc(doc), doc.indexOf("{{icon:e}}")), true);
    // Die Aufzaehlung ist Text, da stehen genau zwei echte Marken ueber ihr
    assert.equal(insideCode(fakeDoc(doc), doc.indexOf("{{icon:f}}")), false);
  },
);

check("Export nimmt den naechsten freien Namen", () => {
  const taken = new Set([
    "icons-export-2026-09-29.json",
    "icons-export-2026-09-29-2.json",
  ]);
  assert.equal(
    freeExportName((p) => taken.has(p), "2026-09-29"),
    "icons-export-2026-09-29-3.json",
  );
  assert.equal(
    freeExportName((p) => taken.has(p), "2026-09-30"),
    "icons-export-2026-09-30.json",
  );
  const leer = new Set<string>();
  assert.equal(
    freeExportName((p) => leer.has(p), "2026-09-29"),
    "icons-export-2026-09-29.json",
  );
});

check("Bereinigung ohne svg ergibt leeren String", () => {
  assert.equal(
    sanitizeSvg("<svg><script>alert(1)</script></svg>"),
    "<svg></svg>",
  );
  assert.equal(sanitizeSvg("<p>kein svg</p>"), "");
  assert.equal(
    sanitizeSvg("<svg><foreignObject>x</foreignObject></svg>"),
    "<svg></svg>",
  );
});

await checkAsync("ensureFolder legt fehlende Ebenen an", async () => {
  const app = testApp();
  const vault = app.vault as unknown as import("obsidian").Vault;
  assert.equal(await ensureFolder(vault, "_assets/icons/devicon"), true);
  assert.deepEqual([...app.vault.folders].sort(), [
    "_assets",
    "_assets/icons",
    "_assets/icons/devicon",
  ]);
  assert.equal(await ensureFolder(vault, "_assets/icons/devicon"), true);
  assert.equal(app.vault.folders.size, 3);
});

await checkAsync("writeSvgFile legt Unterordner an", async () => {
  const app = testApp();
  const vault = app.vault as unknown as import("obsidian").Vault;
  assert.equal(
    await writeSvgFile(vault, "_assets/icons", "devicon/react", "<svg/>"),
    "written",
  );
  assert.equal(
    app.vault.files.get("_assets/icons/devicon/react.svg"),
    "<svg/>",
  );
  assert.ok(app.vault.folders.has("_assets/icons/devicon"));
});

await checkAsync("writeSvgFile überschreibt nichts", async () => {
  const app = testApp();
  const vault = app.vault as unknown as import("obsidian").Vault;
  app.vault.files.set("_assets/icons/server.svg", "<svg id='alt'/>");
  assert.equal(
    await writeSvgFile(vault, "_assets/icons", "server", "<svg id='neu'/>"),
    "exists",
  );
  assert.equal(
    app.vault.files.get("_assets/icons/server.svg"),
    "<svg id='alt'/>",
  );
});

await checkAsync("writeSvgFile ohne Ordner schreibt nicht", async () => {
  const app = testApp();
  const vault = app.vault as unknown as import("obsidian").Vault;
  assert.equal(await writeSvgFile(vault, "", "server", "<svg/>"), "failed");
  assert.equal(app.vault.files.size, 0);
});

check("CdnCache.refs listet die Schlüssel", () => {
  const cache = new CdnCache({
    load: () => ({
      "devicon/react": "<svg/>",
      "simple/github": "<svg/>",
    }),
    save: () => {},
  });
  assert.deepEqual(cache.refs().sort(), ["devicon/react", "simple/github"]);
});

check("saveFilesOnApply bleibt beim Laden erhalten", () => {
  assert.equal(
    readSettings({ saveFilesOnApply: false }).saveFilesOnApply,
    false,
  );
  assert.equal(readSettings({}).saveFilesOnApply, true);
  assert.equal(readSettings({ saveFilesOnApply: "ja" }).saveFilesOnApply, true);
});

check("Shortcode Scan liest verwendete Icons", () => {
  assert.deepEqual(
    refsInText(
      "a {{icon:devicon/react|20|dark:simple/github}} b {{icon:lucide:folder}}",
    ),
    ["devicon/react", "simple/github"],
  );
  assert.deepEqual(refsInText("{{icon:server.svg}}"), ["server"]);
  assert.deepEqual(refsInText("{{icon:🔧}}"), []);
  assert.deepEqual(refsInText("kein Shortcode"), []);
  // Beispiele in Code sind keine Icons, genau wie im Renderer.
  assert.deepEqual(refsInText("`{{icon:name}}` und ``{{icon:x}}``"), []);
  assert.deepEqual(refsInText("```\n{{icon:server}}\n```"), []);
  assert.deepEqual(
    refsInText(
      "Text `{{icon:x}}`\n\n```md\n{{icon:name}}\n```\n\n{{icon:server}}",
    ),
    ["server"],
  );
});

/**
 * Die Obsidian Helfer createEl, createDiv und createSpan haengen ihr Ergebnis
 * an den Empfaenger. Auf document aufzurufen wirft HierarchyRequestError, weil
 * ein Dokument genau ein Kind haben darf, auf einem Element haengt das neue
 * Element sofort im Baum. Die globale Form ohne Empfaenger liefert ein
 * losgeloestes Element und ist die einzige richtige fuer abhaengige Knoten.
 */
check("Kein create-Helfer mit document als Empfaenger", () => {
  const quellen = [
    "cdn.ts",
    "code-context.ts",
    "exchange.ts",
    "explorer.ts",
    "file-save.ts",
    "frontmatter.ts",
    "gallery.ts",
    "i18n.ts",
    "icons.ts",
    "main.ts",
    "mapping.ts",
    "picker.ts",
    "selfhost-catalog.ts",
    "cdn-catalog.ts",
    "settings.ts",
    "shortcodes.ts",
    "suggest.ts",
    "tabs-titles.ts",
  ];
  const verboten = /document\s*\.\s*create(El|Div|Span|Svg)\s*\(/;
  const treffer: string[] = [];
  for (const datei of quellen) {
    // Der Harness laeuft aus der Repo-Wurzel, das stimmt fuer npm test.
    const zeilen = readFileSync(join(process.cwd(), datei), "utf8")
      .split("\n")
      .map((zeile, i) => ({ zeile: zeile.trim(), nr: i + 1 }))
      // Kommentare beschreiben den Fehler und sollen nicht greifen.
      .filter(({ zeile }) => !zeile.startsWith("//") && !zeile.startsWith("*"));
    for (const { zeile, nr } of zeilen) {
      if (verboten.test(zeile)) treffer.push(`${datei}:${nr}`);
    }
  }
  assert.deepEqual(
    treffer,
    [],
    `document als Empfaenger: ${treffer.join(", ")}`,
  );
});

console.log(`# ${count} Tests bestanden (final)`);
