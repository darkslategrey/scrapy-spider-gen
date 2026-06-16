import { type HTMLElement, parse } from "node-html-parser";

// ── Types ──────────────────────────────────────────────────────────────────

export type CleanLevel = "light" | "normal" | "aggressive";

export interface CleanResult {
	html: string;
	/** Original size in bytes */
	sizeBefore: number;
	/** Size after cleaning in bytes */
	sizeAfter: number;
	/** Reduction percentage (0-100) */
	reductionPercent: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * Tags removed regardless of level:
 * they provide no useful structural information for the LLM.
 */
const TAGS_ALWAYS_REMOVED = [
	"script",
	"style",
	"noscript",
	"svg",
	"iframe",
	"canvas",
	"video",
	"audio",
	"picture",
	"template",
	"link",
	"meta",
] as const;

/**
 * Attributes kept in normal and aggressive modes.
 * Only what helps identify selectors is retained.
 */
const ATTRS_TO_KEEP = new Set([
	"id",
	"class",
	"href",
	"src",
	"alt",
	"type",
	"name",
	"value",
	"placeholder",
	"role",
	"aria-label",
	"data-product-id",
	"data-sku",
	"data-price",
	"data-currency",
	"itemprop",
	"itemtype",
	"itemscope",
	"content", // for kept meta tags (e.g. og:price)
]);

/**
 * data-* attribute prefixes kept because they are semantically useful.
 */
const DATA_ATTR_PREFIXES_KEPT = [
	"data-product",
	"data-price",
	"data-sku",
	"data-stock",
	"data-id",
	"data-name",
];

/**
 * Candidate selectors for the product zone (aggressive mode).
 * Ordered from most specific to most generic.
 */
const PRODUCT_ZONE_SELECTORS = [
	"[itemtype*='Product']",
	"[itemtype*='product']",
	"#product",
	".product",
	".product-detail",
	".product-page",
	"[class*='product-detail']",
	"[class*='product-page']",
	"[class*='product-main']",
	"main article",
	"main",
	"article",
	"[role='main']",
	"#content",
	"#main",
	".main-content",
] as const;

// ── Main function ────────────────────────────────────────────────────────

/**
 * Clean an HTML document to reduce noise before sending to the LLM.
 *
 * @param rawHtml  Raw HTML (can be a full document or a fragment)
 * @param level    Cleaning level:
 *   - `light`      → removes scripts/styles/SVG only
 *   - `normal`     → + filters parasitic attributes (default)
 *   - `aggressive` → + extracts product zone only
 */
export function cleanHtml(
	rawHtml: string,
	level: CleanLevel = "normal",
): CleanResult {
	const sizeBefore = byteLength(rawHtml);
	const root = parse(rawHtml, {
		// Preserves data-* attributes so we can filter them ourselves
		lowerCaseTagName: true,
		comment: false,
		blockTextElements: {
			script: false,
			style: false,
		},
	});

	// ── Step 1: remove always-useless tags ─────────────────────────────
	removeTagsAlways(root);

	// ── Step 2 (normal + aggressive): filter attributes ────────────────
	if (level === "normal" || level === "aggressive") {
		filterAttributes(root);
	}

	// ── Step 3 (aggressive): extract product zone ──────────────────────
	let outputRoot: HTMLElement = root;
	if (level === "aggressive") {
		const productZone = extractProductZone(root);
		if (productZone) {
			outputRoot = productZone;
		}
	}

	// ── Final cleanup: consecutive blank lines ─────────────────────────
	const html = collapseBlankLines(outputRoot.innerHTML ?? outputRoot.outerHTML);
	const sizeAfter = byteLength(html);
	const reductionPercent =
		sizeBefore > 0 ? Math.round((1 - sizeAfter / sizeBefore) * 100) : 0;

	return { html, sizeBefore, sizeAfter, reductionPercent };
}

// ── Internal helpers ─────────────────────────────────────────────────────

function removeTagsAlways(root: HTMLElement): void {
	for (const tag of TAGS_ALWAYS_REMOVED) {
		for (const el of root.querySelectorAll(tag)) {
			el.remove();
		}
	}
}

function filterAttributes(root: HTMLElement): void {
	for (const el of root.querySelectorAll("*")) {
		for (const attr of Object.keys(el.attributes)) {
			if (shouldRemoveAttr(attr)) {
				el.removeAttribute(attr);
			}
		}
	}
}

function shouldRemoveAttr(attr: string): boolean {
	if (ATTRS_TO_KEEP.has(attr)) return false;
	for (const prefix of DATA_ATTR_PREFIXES_KEPT) {
		if (attr.startsWith(prefix)) return false;
	}
	return true;
}

function extractProductZone(root: HTMLElement): HTMLElement | null {
	for (const selector of PRODUCT_ZONE_SELECTORS) {
		try {
			const el = root.querySelector(selector);
			if (el && el.innerHTML.trim().length > 100) {
				return el as HTMLElement;
			}
		} catch {
			// Selector not supported by node-html-parser, try next one
		}
	}
	return null;
}

function collapseBlankLines(html: string): string {
	return html.replace(/(\n\s*){3,}/g, "\n\n").trim();
}

function byteLength(str: string): number {
	return Buffer.byteLength(str, "utf8");
}
