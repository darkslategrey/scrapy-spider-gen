# Claude Pi extension
ref. https://claude.ai/chat/97516b73-3af6-4935-8824-c35f14649ba6

## Plan claude extension Pi coder
 
 Oui, tout à fait d'accord, l'extension est le bon choix pour cette raison précise. Voici pourquoi :

## Le problème du volume HTML

Une page e-commerce typique peut facilement peser **500Ko à 2Mo** de HTML brut, dont :
- Les blocs `<style>` et `<link>` CSS inline
- Les blocs `<script>` (souvent le plus gros morceau — analytics, tracking, hydration JS...)
- Les attributs `data-*` en masse
- Le SVG inline des icônes
- Les commentaires HTML

Tout ça est du **bruit pur** pour un LLM qui cherche juste à identifier des sélecteurs CSS/XPath sur le contenu produit.

## Pourquoi l'extension est mieux qu'un skill ici

Un skill ne fait qu'injecter des instructions dans le contexte — le nettoyage du HTML resterait à la charge du LLM, qui recevrait quand même le HTML brut.

Une **extension TypeScript** peut au contraire faire le pré-traitement **avant** d'envoyer quoi que ce soit au LLM :

```
HTML brut (2Mo)
      │
      ▼
[Extension Pi - nettoyage]
  ├── Supprimer <script>, <style>, <svg>
  ├── Supprimer les attributs inutiles (class de style, data-tracking...)
  ├── Garder uniquement le DOM structurel
  └── Optionnel : extraire uniquement la zone produit (main, article...)
      │
      ▼
HTML nettoyé (20-50Ko)
      │
      ▼
[LLM via Pi]  ←  template spider + items définis
      │
      ▼
Spider complété
```

## Ce que l'extension ferait concrètement

1. **Télécharger** la page (ou lire un fichier local)
2. **Parser** le HTML avec une lib comme `node-html-parser` ou `cheerio`
3. **Nettoyer** : supprimer scripts, styles, SVG inline, attributs parasites
4. **Réduire** : optionnellement ne garder que le contenu principal (heuristique sur `<main>`, `<article>`, `[role=main]`...)
5. **Injecter** dans le contexte Pi : HTML nettoyé + template spider
6. **Déclencher** la génération automatiquement

## Un bonus important

L'extension peut aussi exposer un paramètre de **niveau de nettoyage** :
- `--clean=light` → juste scripts/styles supprimés
- `--clean=aggressive` → uniquement balises structurelles + texte
- `--clean=smart` → extraction de la zone produit seulement

Ce qui te donne de la flexibilité selon la complexité du site cible — utile pour Vapalape où tu vas scraper des dizaines de boutiques différentes.

---

Tu veux qu'on attaque le code de l'extension ? On peut commencer par le module de nettoyage HTML qui est le cœur du dispositif.


# Implementation

Pas encore — je n'ai lu que la page d'accueil. Laisse-moi lire la doc complète avant d'écrire une seule ligne.Bien. J'ai maintenant une lecture complète de la doc extensions et packages de Pi. Je suis prêt.

Voici ce que je propose de construire, en respectant scrupuleusement l'API Pi :

## Structure de l'extension

```
~/.pi/agent/extensions/
└── scrapy-spider-gen/
    ├── package.json          ← dépendances (node-html-parser, etc.)
    ├── node_modules/
    └── src/
        ├── index.ts          ← entry point, enregistre commande + outil
        ├── html-cleaner.ts   ← nettoyage HTML (le cœur)
        └── fetcher.ts        ← téléchargement URL ou lecture fichier local
```

## Ce que ça fait concrètement

- Une **commande** `/spider` utilisable depuis Pi : `/spider url=https://... template=./spider.py`
- Un **outil LLM** `clean_html` que Pi peut appeler lui-même pour nettoyer une page avant de générer
- Le nettoyeur retire scripts, styles, SVG, attributs parasites, puis injecte dans le contexte Pi via `before_agent_start`

## Les fichiers

### `package.json`
```json
{
  "name": "scrapy-spider-gen",
  "dependencies": {
    "node-html-parser": "^6.1.0"
  },
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

### `src/fetcher.ts`
```typescript
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export async function fetchHtml(source: string): Promise<string> {
  // Fichier local
  if (existsSync(source)) {
    return readFile(source, "utf8");
  }
  // URL
  const res = await fetch(source, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; scrapy-spider-gen/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${source}`);
  return res.text();
}
```

### `src/html-cleaner.ts`
```typescript
import { parse } from "node-html-parser";

export type CleanLevel = "light" | "normal" | "aggressive";

export function cleanHtml(raw: string, level: CleanLevel = "normal"): string {
  const root = parse(raw);

  // Toujours supprimer
  for (const tag of ["script", "style", "noscript", "svg", "iframe", "canvas"]) {
    root.querySelectorAll(tag).forEach(el => el.remove());
  }

  if (level === "normal" || level === "aggressive") {
    // Supprimer attributs parasites
    const KEEP_ATTRS = new Set(["id", "class", "href", "src", "alt", "type", "name", "value", "data-product-id"]);
    root.querySelectorAll("*").forEach(el => {
      for (const attr of Object.keys(el.attributes)) {
        if (!KEEP_ATTRS.has(attr) && !attr.startsWith("data-product")) {
          el.removeAttribute(attr);
        }
      }
    });
  }

  if (level === "aggressive") {
    // Garder uniquement main/article ou body
    const main = root.querySelector("main, article, [role='main'], #content, .product");
    return main ? main.outerHTML : root.querySelector("body")?.innerHTML ?? root.innerHTML;
  }

  return root.innerHTML;
}
```

### `src/index.ts`
```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { fetchHtml } from "./fetcher.js";
import { cleanHtml, type CleanLevel } from "./html-cleaner.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export default function (pi: ExtensionAPI) {

  // ── Outil LLM : clean_html ─────────────────────────────────────────────
  pi.registerTool({
    name: "clean_html",
    label: "Clean HTML",
    description: "Télécharge une page HTML depuis une URL ou un fichier local, la nettoie (supprime scripts/styles/SVG/attributs parasites) et retourne le HTML structurel pour analyse de sélecteurs Scrapy.",
    promptSnippet: "Nettoie une page HTML pour extraction de sélecteurs Scrapy",
    promptGuidelines: [
      "Use clean_html when asked to generate or complete a Scrapy spider from a web page.",
    ],
    parameters: Type.Object({
      source:  Type.String({ description: "URL https:// ou chemin fichier local vers la page HTML" }),
      level:   StringEnum(["light", "normal", "aggressive"] as const, { description: "Niveau de nettoyage : light, normal (défaut), aggressive" }),
      template: Type.Optional(Type.String({ description: "Chemin vers le fichier template du spider Scrapy" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      onUpdate?.({ content: [{ type: "text", text: `⏳ Récupération de ${params.source}…` }] });
      const raw = await fetchHtml(params.source);
      const sizeBefore = Buffer.byteLength(raw, "utf8");

      onUpdate?.({ content: [{ type: "text", text: `🧹 Nettoyage HTML (mode: ${params.level})…` }] });
      const cleaned = cleanHtml(raw, params.level as CleanLevel);
      const sizeAfter = Buffer.byteLength(cleaned, "utf8");

      let templateContent = "";
      if (params.template) {
        const absPath = resolve(ctx.cwd, params.template);
        templateContent = await readFile(absPath, "utf8");
      }

      const reduction = Math.round((1 - sizeAfter / sizeBefore) * 100);
      const summary = `HTML nettoyé : ${(sizeBefore/1024).toFixed(0)}Ko → ${(sizeAfter/1024).toFixed(0)}Ko (−${reduction}%)\n\n`;

      const output = templateContent
        ? `${summary}## Template spider :\n\`\`\`python\n${templateContent}\n\`\`\`\n\n## HTML nettoyé :\n\`\`\`html\n${cleaned}\n\`\`\``
        : `${summary}## HTML nettoyé :\n\`\`\`html\n${cleaned}\n\`\`\``;

      return {
        content: [{ type: "text", text: output }],
        details: { sizeBefore, sizeAfter, reduction, source: params.source },
      };
    },
  });

  // ── Commande /spider ────────────────────────────────────────────────────
  pi.registerCommand("spider", {
    description: "Génère un spider Scrapy depuis une URL ou page HTML. Usage: /spider url=<url> [template=<path>] [level=light|normal|aggressive]",
    handler: async (args, ctx) => {
      // Parser les args "clé=valeur"
      const params = Object.fromEntries(
        (args ?? "").split(/\s+/)
          .filter(a => a.includes("="))
          .map(a => a.split("=") as [string, string])
      );

      const source = params.url ?? params.source;
      if (!source) {
        ctx.ui.notify("Usage : /spider url=https://... [template=./spider.py] [level=light|normal|aggressive]", "error");
        return;
      }

      const level = (params.level ?? "normal") as CleanLevel;
      const template = params.template;

      ctx.ui.notify(`🕷️  Génération spider depuis ${source}…`, "info");

      await ctx.waitForIdle();

      // Déclencher le LLM avec le contexte préparé
      pi.sendUserMessage(
        `Utilise l'outil clean_html avec source="${source}", level="${level}"${template ? `, template="${template}"` : ""}, puis génère un spider Scrapy complet qui extrait tous les champs produit disponibles (nom, prix, description, images, SKU, disponibilité…) en utilisant des sélecteurs CSS ou XPath robustes.`,
        { deliverAs: "followUp" }
      );
    },
  });
}
```

---

Tu veux qu'on affine quelque chose avant que je génère les fichiers finaux ? Notamment :

- La liste des attributs HTML à conserver dans le mode `normal`
- La stratégie d'extraction de la zone produit en mode `aggressive` (les sélecteurs heuristiques)
- Ou est-ce qu'on part direct sur les fichiers et on itère ensuite ?

