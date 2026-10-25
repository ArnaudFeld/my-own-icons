import { getLanguage } from "obsidian";

/** Slogan je Sprache, alle anderen Sprachen fallen auf Englisch zurück. */
const SLOGANS: Record<string, string> = {
  en: "Local, lightweight, yours.",
  de: "Lokal, leicht, deins.",
  fr: "Local, léger, à vous.",
  es: "Local, ligero, tuyo.",
};

/** Alle UI Texte in vier Sprachen, Rückfall ist Englisch. */
const STRINGS: Record<string, Record<string, string>> = {
  de: {
    "cmd.reload": "Icons neu laden",
    "cmd.gallery": "Icon Galerie öffnen",
    "cmd.check": "Icons prüfen",
    "cmd.export": "Icons exportieren",
    "cmd.import": "Icons importieren",
    "cmd.pickActive": "Icon für aktive Datei wählen",
    "cmd.insert": "Icon in Notiz einfügen",

    "menu.change": "Icon ändern",
    "menu.remove": "Icon entfernen",
    "menu.changeMany": "Icons ändern ({count})",
    "menu.removeMany": "Icons entfernen ({count})",
    "menu.insert": "Icon einfügen",

    "notice.iconSaveFailed": "Icon konnte nicht gespeichert werden",
    "notice.iconsSaveFailed": "Icons konnten nicht gespeichert werden",
    "notice.iconsRemoveFailed": "Icons konnten nicht entfernt werden",
    "notice.onlySvg": "Nur SVG Referenzen lassen sich speichern",
    "notice.notInCache": "Icon nicht im Cache, bitte erneut wählen",
    "notice.fileExists": "Datei existiert bereits",
    "notice.fileSaveFailed": "Datei konnte nicht gespeichert werden",
    "notice.saved": "Gespeichert: {path}",
    "notice.invalidExt": "Ungültige Endung",
    "notice.conflict":
      "{names} ist auch aktiv und verändert Explorer Icons, es kann zu Überschneidungen kommen.",
    "notice.checkOk": "Icons ok: {used} vergeben, {unused} ungenutzt",
    "notice.scanning": "Notizen werden durchsucht, einen Moment.",
    "notice.saveAllDone":
      "{written} gespeichert, {exists} schon vorhanden, {failed} fehlgeschlagen.",

    "saveAll.title": "Icons als Dateien speichern",
    "saveAll.hint":
      "Vorhandene Dateien werden nicht überschrieben. Der Icon Ordner wird bei Bedarf angelegt.",
    "saveAll.usedLine": "Verwendet: {count} neu, {exists} schon vorhanden.",
    "saveAll.cacheLine": "Mit Cache: {count} neu, {exists} schon vorhanden.",
    "saveAll.used": "Nur verwendete ({count})",
    "saveAll.cache": "Auch aus dem Cache ({count})",
    "saveAll.cancel": "Abbrechen",

    "cat.devicon": "Devicon: {value}",
    "cat.simple": "Simple: {value}",
    "cat.selfhost": "Self-Hosted: {value}",
    "cat.builtinVersion": "eingebaut (v2.17.0)",
    "cat.builtinCurated": "eingebaut (kuratiert)",
    "cat.builtinDate": "eingebaut ({date})",
    "cat.off": "CDN aus, nur Dateien und Lucide.",

    "set.iconFolder.name": "Icon Ordner",
    "set.iconFolder.desc":
      "Pfad im Vault, ohne führenden Schrägstrich. Der Ordner wird beim Speichern angelegt.",
    "set.mappingFile.name": "Mapping Datei",
    "set.mappingFile.desc":
      "Zuordnung Explorer Pfad auf Icon, als JSON im Vault.",
    "set.ext.name": "Dateityp Icons",
    "set.ext.desc":
      "Rückfall pro Endung nach Pfad und Frontmatter. Start leer.",
    "set.ext.change": "Ändern",
    "set.ext.add.name": "Endung hinzufügen",
    "set.ext.add.desc": "Ohne Punkt, z.B. md.",
    "set.ext.pick": "Wählen",
    "set.cdn.name": "CDN Nachladen",
    "set.cdn.desc":
      "Fehlende Devicon und Simple Icons von jsdelivr laden und auf diesem Gerät cachen. Teilt sich den Cache mit Self-Hosted.",
    "set.selfhost.name": "Self-Hosted Icons",
    "set.selfhost.desc":
      "Homelab Marken von selfh.st per CDN, CC-BY-4.0 mit Namensnennung in der README.",
    "set.saveOnPick.name": "Beim Setzen als Datei speichern",
    "set.saveOnPick.desc":
      "Das gewählte Icon gleich als SVG in den Icon Ordner schreiben, damit es ohne CDN bleibt. Vorhandene Dateien bleiben unverändert.",
    "set.stand.name": "Katalog Stand",
    "set.stand.reload": "Neu laden",
    "set.cache.name": "Icon Cache",
    "set.cache.count": "{count} Icons auf diesem Gerät.",
    "set.cache.clear": "Leeren",
    "set.saveAll.name": "Bestehende Icons als Dateien speichern",
    "set.saveAll.desc":
      "Durchsucht Notizen nach verwendeten Icons und schreibt sie als SVG in den Icon Ordner.",
    "set.autoLight.name": "Helle Variante automatisch",
    "set.autoLight.desc":
      "Im dunklen Theme die helle Self-Hosted Variante nehmen wenn vorhanden. Hand Wahl gewinnt.",
    "set.tabs.name": "Tab Icons",
    "set.tabs.desc": "Mapping und Frontmatter Icons in der Tableiste zeigen.",
    "set.titles.name": "Titel Icons",
    "set.titles.desc":
      "Mapping und Frontmatter Icons vor dem Notiz Titel zeigen.",
    "set.export.name": "Paket exportieren",
    "set.export.desc":
      "Mapping plus genutzte Icons als Datei für Zweit Vaults.",
    "set.export.btn": "Exportieren",
    "set.import.name": "Paket importieren",
    "set.import.desc":
      "icons-export.json einlesen und Icons nach _assets/icons schreiben.",
    "set.import.btn": "Importieren",

    "pick.title": "Icon wählen",
    "pick.search.name": "Suchen",
    "pick.search.ph": "Name tippen …",
    "pick.size.name": "Größe (optional)",
    "pick.size.desc": "Leer lassen für Standard, Zahl gilt als Pixel.",
    "pick.size.ph": "1.4em oder 20",
    "pick.color": "Farbe",
    "pick.colorOff": "Aus",
    "pick.colorDefault": "Standard",
    "pick.colorNoneTip": "Keine Farbe, Standard verwenden",
    "pick.colorFree": "Freie Farbe wählen",
    "pick.hex": "Hex Wert",
    "pick.cancel": "Abbrechen",
    "pick.saveFile": "Als Datei speichern",
    "pick.apply": "Übernehmen",
    "pick.dark": "Dark-Icon wählen",
    "pick.darkTip":
      "Icon für den Dark Mode festlegen: danach ein Icon aus der Liste anklicken, es wird nur im dunklen Theme gezeigt.",
    "pick.darkCancel": "Auswahl abbrechen",
    "pick.darkHint":
      "Jetzt ein Icon aus der Liste anklicken → wird Dark-Mode-Icon",
    "pick.darkValue": "Dark Mode: {value}",
    "pick.darkSame": "Dark Mode: wie helles Icon",
    "pick.none": "Nichts gefunden",
    "pick.more": "… {count} weitere, Suche einschränken",
    "pick.favToggle": "Favorit umschalten",
    "pick.contrast": "Schwacher Kontrast in diesem Theme ({ratio}:1)",

    "group.favorites": "Favoriten",
    "group.recent": "Zuletzt",
    "group.own": "Eigene",
    "group.devicon": "Devicon",
    "group.simple": "Simple",
    "group.selfhosted": "Self-Hosted",
    "group.lucide": "Lucide",

    "color.red": "Rot",
    "color.orange": "Orange",
    "color.yellow": "Gelb",
    "color.green": "Grün",
    "color.cyan": "Türkis",
    "color.blue": "Blau",
    "color.purple": "Lila",
    "color.pink": "Pink",
    "color.gray": "Grau",

    "gal.title": "Icon Galerie",
    "gal.assigned": "Vergeben ({count} Pfade, {rules} Regeln)",
    "gal.empty": "Noch keine Icons vergeben",
    "gal.remove": "Entfernen",
    "gal.ext": "Dateityp ({count})",
    "gal.unused": "Ungenutzt ({count})",
    "gal.allUsed": "Alles in Verwendung",
    "gal.more": "… {count} weitere",
    "gal.dark": "dunkel: {value}",

    "check.title": "Icons prüfen",
    "check.summary": "{used} vergeben, {unused} ungenutzt, {broken} defekt",

    "ex.done": "Exportiert: {path}",
    "ex.tooBig": "Import fehlgeschlagen: Datei zu groß",
    "ex.invalid": "Import fehlgeschlagen: keine gültige Datei",
    "ex.writeErr": "Import abgebrochen: Schreibfehler, Teilstand bleibt",
    "ex.imported":
      "Importiert: {entries} Einträge, {files} Dateien ({skipped} übersprungen)",
  },
  en: {
    "cmd.reload": "Reload icons",
    "cmd.gallery": "Open icon gallery",
    "cmd.check": "Check icons",
    "cmd.export": "Export icons",
    "cmd.import": "Import icons",
    "cmd.pickActive": "Choose icon for active file",
    "cmd.insert": "Insert icon into note",

    "menu.change": "Change icon",
    "menu.remove": "Remove icon",
    "menu.changeMany": "Change icons ({count})",
    "menu.removeMany": "Remove icons ({count})",
    "menu.insert": "Insert icon",

    "notice.iconSaveFailed": "Could not save the icon",
    "notice.iconsSaveFailed": "Could not save the icons",
    "notice.iconsRemoveFailed": "Could not remove the icons",
    "notice.onlySvg": "Only SVG references can be saved",
    "notice.notInCache": "Icon is not in the cache, please select it again",
    "notice.fileExists": "File already exists",
    "notice.fileSaveFailed": "Could not save the file",
    "notice.saved": "Saved: {path}",
    "notice.invalidExt": "Invalid extension",
    "notice.conflict":
      "{names} is active too and modifies explorer icons, overlaps may occur.",
    "notice.checkOk": "Icons ok: {used} assigned, {unused} unused",
    "notice.scanning": "Scanning notes, one moment.",
    "notice.saveAllDone":
      "{written} saved, {exists} already present, {failed} failed.",

    "saveAll.title": "Save icons as files",
    "saveAll.hint":
      "Existing files are not overwritten. The icon folder is created when needed.",
    "saveAll.usedLine": "Used: {count} new, {exists} already present.",
    "saveAll.cacheLine": "With cache: {count} new, {exists} already present.",
    "saveAll.used": "Used only ({count})",
    "saveAll.cache": "Include cache ({count})",
    "saveAll.cancel": "Cancel",

    "cat.devicon": "Devicon: {value}",
    "cat.simple": "Simple: {value}",
    "cat.selfhost": "Self-hosted: {value}",
    "cat.builtinVersion": "built-in (v2.17.0)",
    "cat.builtinCurated": "built-in (curated)",
    "cat.builtinDate": "built-in ({date})",
    "cat.off": "CDN off, only files and Lucide.",

    "set.iconFolder.name": "Icon folder",
    "set.iconFolder.desc":
      "Path in the vault, without leading slash. The folder is created when an icon is saved.",
    "set.mappingFile.name": "Mapping file",
    "set.mappingFile.desc":
      "Maps explorer paths to icons, stored as JSON in the vault.",
    "set.ext.name": "File type icons",
    "set.ext.desc":
      "Fallback per extension, after path and frontmatter. Starts empty.",
    "set.ext.change": "Change",
    "set.ext.add.name": "Add extension",
    "set.ext.add.desc": "Without dot, e.g. md.",
    "set.ext.pick": "Pick",
    "set.cdn.name": "Load from CDN",
    "set.cdn.desc":
      "Fetch missing Devicon and Simple icons from jsdelivr and cache them on this device. Shares the cache with self-hosted.",
    "set.selfhost.name": "Self-hosted icons",
    "set.selfhost.desc":
      "Homelab brands from selfh.st via CDN, CC-BY-4.0, credit in the README.",
    "set.saveOnPick.name": "Save as file when assigning",
    "set.saveOnPick.desc":
      "Write the chosen icon straight into the icon folder as SVG so it keeps working without the CDN. Existing files stay untouched.",
    "set.stand.name": "Catalog version",
    "set.stand.reload": "Reload",
    "set.cache.name": "Icon cache",
    "set.cache.count": "{count} icons on this device.",
    "set.cache.clear": "Clear",
    "set.saveAll.name": "Save existing icons as files",
    "set.saveAll.desc":
      "Scans notes for used icons and writes them into the icon folder as SVG.",
    "set.autoLight.name": "Automatic light variant",
    "set.autoLight.desc":
      "In dark mode use the light self-hosted variant when available. A manual choice always wins.",
    "set.tabs.name": "Tab icons",
    "set.tabs.desc": "Show mapping and frontmatter icons in the tab bar.",
    "set.titles.name": "Title icons",
    "set.titles.desc":
      "Show mapping and frontmatter icons in front of the note title.",
    "set.export.name": "Export package",
    "set.export.desc": "Mapping plus used icons as a file for second vaults.",
    "set.export.btn": "Export",
    "set.import.name": "Import package",
    "set.import.desc":
      "Read icons-export.json and write icons to _assets/icons.",
    "set.import.btn": "Import",

    "pick.title": "Choose icon",
    "pick.search.name": "Search",
    "pick.search.ph": "Type a name …",
    "pick.size.name": "Size (optional)",
    "pick.size.desc":
      "Leave empty for default, a plain number counts as pixels.",
    "pick.size.ph": "1.4em or 20",
    "pick.color": "Color",
    "pick.colorOff": "Off",
    "pick.colorDefault": "Default",
    "pick.colorNoneTip": "No color, use default",
    "pick.colorFree": "Pick a custom color",
    "pick.hex": "Hex value",
    "pick.cancel": "Cancel",
    "pick.saveFile": "Save as file",
    "pick.apply": "Apply",
    "pick.dark": "Choose dark icon",
    "pick.darkTip":
      "Set an icon for dark mode: then click an icon in the list, it shows only in the dark theme.",
    "pick.darkCancel": "Cancel selection",
    "pick.darkHint":
      "Now click an icon in the list → becomes the dark mode icon",
    "pick.darkValue": "Dark mode: {value}",
    "pick.darkSame": "Dark mode: same as light icon",
    "pick.none": "Nothing found",
    "pick.more": "… {count} more, narrow the search",
    "pick.favToggle": "Toggle favorite",
    "pick.contrast": "Low contrast in this theme ({ratio}:1)",

    "group.favorites": "Favorites",
    "group.recent": "Recent",
    "group.own": "Own",
    "group.devicon": "Devicon",
    "group.simple": "Simple",
    "group.selfhosted": "Self-Hosted",
    "group.lucide": "Lucide",

    "color.red": "Red",
    "color.orange": "Orange",
    "color.yellow": "Yellow",
    "color.green": "Green",
    "color.cyan": "Cyan",
    "color.blue": "Blue",
    "color.purple": "Purple",
    "color.pink": "Pink",
    "color.gray": "Gray",

    "gal.title": "Icon gallery",
    "gal.assigned": "Assigned ({count} paths, {rules} rules)",
    "gal.empty": "No icons assigned yet",
    "gal.remove": "Remove",
    "gal.ext": "File type ({count})",
    "gal.unused": "Unused ({count})",
    "gal.allUsed": "Everything in use",
    "gal.more": "… {count} more",
    "gal.dark": "dark: {value}",

    "check.title": "Check icons",
    "check.summary": "{used} assigned, {unused} unused, {broken} broken",

    "ex.done": "Exported: {path}",
    "ex.tooBig": "Import failed: file too large",
    "ex.invalid": "Import failed: not a valid file",
    "ex.writeErr": "Import aborted: write error, partial state remains",
    "ex.imported":
      "Imported: {entries} entries, {files} files ({skipped} skipped)",
  },
  fr: {
    "cmd.reload": "Recharger les icônes",
    "cmd.gallery": "Ouvrir la galerie d'icônes",
    "cmd.check": "Vérifier les icônes",
    "cmd.export": "Exporter les icônes",
    "cmd.import": "Importer les icônes",
    "cmd.pickActive": "Choisir une icône pour le fichier actif",
    "cmd.insert": "Insérer une icône dans la note",

    "menu.change": "Changer l'icône",
    "menu.remove": "Supprimer l'icône",
    "menu.changeMany": "Changer les icônes ({count})",
    "menu.removeMany": "Supprimer les icônes ({count})",
    "menu.insert": "Insérer une icône",

    "notice.iconSaveFailed": "Impossible d'enregistrer l'icône",
    "notice.iconsSaveFailed": "Impossible d'enregistrer les icônes",
    "notice.iconsRemoveFailed": "Impossible de supprimer les icônes",
    "notice.onlySvg": "Seules les références SVG peuvent être enregistrées",
    "notice.notInCache": "Icône absente du cache, veuillez la resélectionner",
    "notice.fileExists": "Le fichier existe déjà",
    "notice.fileSaveFailed": "Impossible d'enregistrer le fichier",
    "notice.saved": "Enregistré : {path}",
    "notice.invalidExt": "Extension invalide",
    "notice.conflict":
      "{names} est aussi actif et modifie les icônes de l'explorateur, des chevauchements sont possibles.",
    "notice.checkOk": "Icônes ok : {used} attribuées, {unused} non utilisées",

    "cat.devicon": "Devicon : {value}",
    "cat.simple": "Simple : {value}",
    "cat.selfhost": "Auto-hébergé : {value}",
    "cat.builtinVersion": "intégré (v2.17.0)",
    "cat.builtinCurated": "intégré (sélection)",
    "cat.builtinDate": "intégré ({date})",
    "cat.off": "CDN désactivé, fichiers et Lucide uniquement.",

    "set.iconFolder.name": "Dossier d'icônes",
    "set.iconFolder.desc":
      "Chemin dans le coffre, sans barre oblique initiale. Le dossier est créé lors de l'enregistrement.",
    "set.mappingFile.name": "Fichier de mappage",
    "set.mappingFile.desc":
      "Associe les chemins de l'explorateur aux icônes, en JSON dans le coffre.",
    "set.ext.name": "Icônes par type de fichier",
    "set.ext.desc":
      "Repli par extension, après chemin et frontmatter. Vide au départ.",
    "set.ext.change": "Modifier",
    "set.ext.add.name": "Ajouter une extension",
    "set.ext.add.desc": "Sans point, par ex. md.",
    "set.ext.pick": "Choisir",
    "set.cdn.name": "Chargement depuis le CDN",
    "set.cdn.desc":
      "Récupère les icônes Devicon et Simple manquantes depuis jsdelivr et les met en cache sur cet appareil. Partage le cache avec l'auto-hébergement.",
    "set.selfhost.name": "Icônes auto-hébergées",
    "set.selfhost.desc":
      "Marques homelab de selfh.st via CDN, CC-BY-4.0, mention dans le README.",
    "set.saveOnPick.name": "Enregistrer comme fichier lors de l'attribution",
    "set.saveOnPick.desc":
      "Écrire directement l'icône choisie en SVG dans le dossier d'icônes pour qu'elle reste disponible sans CDN. Les fichiers existants ne sont pas modifiés.",
    "set.stand.name": "Version du catalogue",
    "set.stand.reload": "Recharger",
    "set.cache.name": "Cache d'icônes",
    "set.cache.count": "{count} icônes sur cet appareil.",
    "set.cache.clear": "Vider",
    "set.saveAll.name": "Enregistrer les icônes existantes comme fichiers",
    "set.saveAll.desc":
      "Parcourt les notes pour trouver les icônes utilisées et les écrit en SVG dans le dossier d'icônes.",
    "set.autoLight.name": "Variante claire automatique",
    "set.autoLight.desc":
      "En mode sombre, utiliser la variante claire auto-hébergée si disponible. Un choix manuel prime toujours.",
    "set.tabs.name": "Icônes des onglets",
    "set.tabs.desc":
      "Afficher les icônes du mappage et du frontmatter dans la barre d'onglets.",
    "set.titles.name": "Icônes des titres",
    "set.titles.desc":
      "Afficher les icônes du mappage et du frontmatter devant le titre de la note.",
    "set.export.name": "Exporter le paquet",
    "set.export.desc":
      "Mappage et icônes utilisées dans un fichier pour d'autres coffres.",
    "set.export.btn": "Exporter",
    "set.import.name": "Importer le paquet",
    "set.import.desc":
      "Lire icons-export.json et écrire les icônes dans _assets/icons.",
    "set.import.btn": "Importer",

    "pick.title": "Choisir une icône",
    "pick.search.name": "Rechercher",
    "pick.search.ph": "Tapez un nom …",
    "pick.size.name": "Taille (optionnel)",
    "pick.size.desc":
      "Laissez vide pour la valeur par défaut, un nombre simple compte en pixels.",
    "pick.size.ph": "1.4em ou 20",
    "pick.color": "Couleur",
    "pick.colorOff": "Aucune",
    "pick.colorDefault": "Par défaut",
    "pick.colorNoneTip": "Aucune couleur, utiliser la valeur par défaut",
    "pick.colorFree": "Choisir une couleur libre",
    "pick.hex": "Valeur hex",
    "pick.cancel": "Annuler",
    "pick.saveFile": "Enregistrer comme fichier",
    "pick.apply": "Appliquer",
    "pick.dark": "Choisir l'icône sombre",
    "pick.darkTip":
      "Définir une icône pour le mode sombre : cliquez ensuite sur une icône de la liste, elle ne s'affichera qu'en thème sombre.",
    "pick.darkCancel": "Annuler la sélection",
    "pick.darkHint":
      "Cliquez maintenant sur une icône de la liste → devient l'icône du mode sombre",
    "pick.darkValue": "Mode sombre : {value}",
    "pick.darkSame": "Mode sombre : comme l'icône claire",
    "pick.none": "Aucun résultat",
    "pick.more": "… {count} de plus, affinez la recherche",
    "pick.favToggle": "Basculer le favori",
    "pick.contrast": "Faible contraste dans ce thème ({ratio}:1)",

    "group.favorites": "Favoris",
    "group.recent": "Récents",
    "group.own": "Personnelles",
    "group.devicon": "Devicon",
    "group.simple": "Simple",
    "group.selfhosted": "Auto-hébergé",
    "group.lucide": "Lucide",

    "color.red": "Rouge",
    "color.orange": "Orange",
    "color.yellow": "Jaune",
    "color.green": "Vert",
    "color.cyan": "Cyan",
    "color.blue": "Bleu",
    "color.purple": "Violet",
    "color.pink": "Rose",
    "color.gray": "Gris",

    "gal.title": "Galerie d'icônes",
    "gal.assigned": "Attribuées ({count} chemins, {rules} règles)",
    "gal.empty": "Aucune icône attribuée",
    "gal.remove": "Supprimer",
    "gal.ext": "Type de fichier ({count})",
    "gal.unused": "Non utilisées ({count})",
    "gal.allUsed": "Tout est utilisé",
    "gal.more": "… {count} de plus",
    "gal.dark": "sombre : {value}",

    "check.title": "Vérifier les icônes",
    "check.summary":
      "{used} attribuées, {unused} non utilisées, {broken} cassées",
    "notice.scanning": "Analyse des notes en cours, un instant.",
    "notice.saveAllDone":
      "{written} enregistrées, {exists} déjà présentes, {failed} en échec.",

    "saveAll.title": "Enregistrer les icônes comme fichiers",
    "saveAll.hint":
      "Les fichiers existants ne sont pas écrasés. Le dossier d'icônes est créé au besoin.",
    "saveAll.usedLine":
      "Utilisées : {count} nouvelles, {exists} déjà présentes.",
    "saveAll.cacheLine":
      "Avec le cache : {count} nouvelles, {exists} déjà présentes.",
    "saveAll.used": "Utilisées seulement ({count})",
    "saveAll.cache": "Inclure le cache ({count})",
    "saveAll.cancel": "Annuler",

    "ex.done": "Exporté : {path}",
    "ex.tooBig": "Échec de l'import : fichier trop volumineux",
    "ex.invalid": "Échec de l'import : fichier non valide",
    "ex.writeErr":
      "Import interrompu : erreur d'écriture, état partiel conservé",
    "ex.imported":
      "Importé : {entries} entrées, {files} fichiers ({skipped} ignorés)",
  },
  es: {
    "cmd.reload": "Recargar iconos",
    "cmd.gallery": "Abrir galería de iconos",
    "cmd.check": "Comprobar iconos",
    "cmd.export": "Exportar iconos",
    "cmd.import": "Importar iconos",
    "cmd.pickActive": "Elegir icono para el archivo activo",
    "cmd.insert": "Insertar icono en la nota",

    "menu.change": "Cambiar icono",
    "menu.remove": "Quitar icono",
    "menu.changeMany": "Cambiar iconos ({count})",
    "menu.removeMany": "Quitar iconos ({count})",
    "menu.insert": "Insertar icono",

    "notice.iconSaveFailed": "No se pudo guardar el icono",
    "notice.iconsSaveFailed": "No se pudieron guardar los iconos",
    "notice.iconsRemoveFailed": "No se pudieron quitar los iconos",
    "notice.onlySvg": "Solo se pueden guardar referencias SVG",
    "notice.notInCache": "El icono no está en la caché, selecciónalo de nuevo",
    "notice.fileExists": "El archivo ya existe",
    "notice.fileSaveFailed": "No se pudo guardar el archivo",
    "notice.saved": "Guardado: {path}",
    "notice.invalidExt": "Extensión no válida",
    "notice.conflict":
      "{names} también está activo y modifica los iconos del explorador, pueden surgir conflictos.",
    "notice.checkOk": "Iconos ok: {used} asignados, {unused} sin usar",

    "cat.devicon": "Devicon: {value}",
    "cat.simple": "Simple: {value}",
    "cat.selfhost": "Autoalojado: {value}",
    "cat.builtinVersion": "integrado (v2.17.0)",
    "cat.builtinCurated": "integrado (selección)",
    "cat.builtinDate": "integrado ({date})",
    "cat.off": "CDN desactivado, solo archivos y Lucide.",

    "set.iconFolder.name": "Carpeta de iconos",
    "set.iconFolder.desc":
      "Ruta en el baúl, sin barra inicial. La carpeta se crea al guardar.",
    "set.mappingFile.name": "Archivo de mapeo",
    "set.mappingFile.desc":
      "Asigna rutas del explorador a iconos, como JSON en el baúl.",
    "set.ext.name": "Iconos por tipo de archivo",
    "set.ext.desc":
      "Respaldo por extensión, tras ruta y frontmatter. Empieza vacío.",
    "set.ext.change": "Cambiar",
    "set.ext.add.name": "Añadir extensión",
    "set.ext.add.desc": "Sin punto, p. ej. md.",
    "set.ext.pick": "Elegir",
    "set.cdn.name": "Cargar desde CDN",
    "set.cdn.desc":
      "Descarga de jsdelivr los iconos Devicon y Simple que falten y los guarda en caché en este dispositivo. Comparte la caché con autoalojado.",
    "set.selfhost.name": "Iconos autoalojados",
    "set.selfhost.desc":
      "Marcas homelab de selfh.st vía CDN, CC-BY-4.0, crédito en el README.",
    "set.saveOnPick.name": "Guardar como archivo al asignar",
    "set.saveOnPick.desc":
      "Escribe el icono elegido directamente como SVG en la carpeta de iconos para que siga disponible sin CDN. Los archivos existentes no se tocan.",
    "set.stand.name": "Versión del catálogo",
    "set.stand.reload": "Recargar",
    "set.cache.name": "Caché de iconos",
    "set.cache.count": "{count} iconos en este dispositivo.",
    "set.cache.clear": "Vaciar",
    "set.saveAll.name": "Guardar iconos existentes como archivos",
    "set.saveAll.desc":
      "Recorre las notas en busca de iconos usados y los escribe como SVG en la carpeta de iconos.",
    "set.autoLight.name": "Variante clara automática",
    "set.autoLight.desc":
      "En modo oscuro usar la variante clara autoalojada si existe. Una elección manual siempre gana.",
    "set.tabs.name": "Iconos en pestañas",
    "set.tabs.desc":
      "Mostrar iconos de mapeo y frontmatter en la barra de pestañas.",
    "set.titles.name": "Iconos en títulos",
    "set.titles.desc":
      "Mostrar iconos de mapeo y frontmatter delante del título de la nota.",
    "set.export.name": "Exportar paquete",
    "set.export.desc": "Mapeo e iconos usados como archivo para otros baúles.",
    "set.export.btn": "Exportar",
    "set.import.name": "Importar paquete",
    "set.import.desc":
      "Leer icons-export.json y escribir iconos en _assets/icons.",
    "set.import.btn": "Importar",

    "pick.title": "Elegir icono",
    "pick.search.name": "Buscar",
    "pick.search.ph": "Escribe un nombre …",
    "pick.size.name": "Tamaño (opcional)",
    "pick.size.desc":
      "Déjalo vacío para el valor por defecto; un número simple cuenta como píxeles.",
    "pick.size.ph": "1.4em o 20",
    "pick.color": "Color",
    "pick.colorOff": "Ninguno",
    "pick.colorDefault": "Por defecto",
    "pick.colorNoneTip": "Sin color, usar el valor por defecto",
    "pick.colorFree": "Elegir un color libre",
    "pick.hex": "Valor hex",
    "pick.cancel": "Cancelar",
    "pick.saveFile": "Guardar como archivo",
    "pick.apply": "Aplicar",
    "pick.dark": "Elegir icono oscuro",
    "pick.darkTip":
      "Define un icono para el modo oscuro: luego haz clic en un icono de la lista, solo se mostrará en el tema oscuro.",
    "pick.darkCancel": "Cancelar selección",
    "pick.darkHint":
      "Ahora haz clic en un icono de la lista → será el icono del modo oscuro",
    "pick.darkValue": "Modo oscuro: {value}",
    "pick.darkSame": "Modo oscuro: igual que el icono claro",
    "pick.none": "Sin resultados",
    "pick.more": "… {count} más, acota la búsqueda",
    "pick.favToggle": "Alternar favorito",
    "pick.contrast": "Bajo contraste en este tema ({ratio}:1)",

    "group.favorites": "Favoritos",
    "group.recent": "Recientes",
    "group.own": "Propios",
    "group.devicon": "Devicon",
    "group.simple": "Simple",
    "group.selfhosted": "Autoalojado",
    "group.lucide": "Lucide",

    "color.red": "Rojo",
    "color.orange": "Naranja",
    "color.yellow": "Amarillo",
    "color.green": "Verde",
    "color.cyan": "Cian",
    "color.blue": "Azul",
    "color.purple": "Morado",
    "color.pink": "Rosa",
    "color.gray": "Gris",

    "gal.title": "Galería de iconos",
    "gal.assigned": "Asignados ({count} rutas, {rules} reglas)",
    "gal.empty": "Aún no hay iconos asignados",
    "gal.remove": "Quitar",
    "gal.ext": "Tipo de archivo ({count})",
    "gal.unused": "Sin usar ({count})",
    "gal.allUsed": "Todo en uso",
    "gal.more": "… {count} más",
    "gal.dark": "oscuro: {value}",

    "check.title": "Comprobar iconos",
    "check.summary":
      "{used} asignados, {unused} sin usar, {broken} defectuosos",
    "notice.scanning": "Analizando las notas, un momento.",
    "notice.saveAllDone":
      "{written} guardados, {exists} ya presentes, {failed} fallidos.",

    "saveAll.title": "Guardar iconos como archivos",
    "saveAll.hint":
      "Los archivos existentes no se sobrescriben. La carpeta de iconos se crea si hace falta.",
    "saveAll.usedLine": "Usados: {count} nuevos, {exists} ya presentes.",
    "saveAll.cacheLine": "Con caché: {count} nuevos, {exists} ya presentes.",
    "saveAll.used": "Solo usados ({count})",
    "saveAll.cache": "Incluir caché ({count})",
    "saveAll.cancel": "Cancelar",

    "ex.done": "Exportado: {path}",
    "ex.tooBig": "Error de importación: archivo demasiado grande",
    "ex.invalid": "Error de importación: archivo no válido",
    "ex.writeErr":
      "Importación cancelada: error de escritura, queda un estado parcial",
    "ex.imported":
      "Importado: {entries} entradas, {files} archivos ({skipped} omitidos)",
  },
};

/**
 * ISO Code der eingestellten App Sprache, ohne Regionsanteil.
 * Ältere Obsidian Versionen kennen getLanguage nicht, dann gilt Englisch.
 */
export function currentLanguage(): string {
  try {
    if (typeof getLanguage !== "function") return "en";
    const raw = getLanguage();
    if (typeof raw !== "string" || raw.length === 0) return "en";
    return raw.toLowerCase().split("-")[0];
  } catch {
    return "en";
  }
}

/** Slogan in der Sprache der App. */
export function slogan(): string {
  return SLOGANS[currentLanguage()] ?? SLOGANS.en;
}

/** UI Text in der Sprache der App, Platzhalter als {name}. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const lang = currentLanguage();
  const table = STRINGS[lang] ?? STRINGS.en;
  let out = table[key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.split(`{${name}}`).join(String(value));
    }
  }
  return out;
}

/** Anzeigename einer Theme Farbe. */
export function colorName(name: string): string {
  return t(`color.${name}`);
}

/** Schlüssel, die in einer Sprache gegenüber der Vereinigungsmenge fehlen. */
export function missingTranslations(): { lang: string; keys: string[] }[] {
  const all = new Set<string>();
  for (const table of Object.values(STRINGS)) {
    for (const key of Object.keys(table)) all.add(key);
  }
  const out: { lang: string; keys: string[] }[] = [];
  for (const [lang, table] of Object.entries(STRINGS)) {
    const keys = [...all].filter((key) => !(key in table));
    if (keys.length > 0) out.push({ lang, keys });
  }
  return out;
}
