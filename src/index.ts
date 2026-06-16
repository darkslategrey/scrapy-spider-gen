import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ArgParseError, parseSpiderArgs, resolvePrompt } from "./arg-parser.ts";
import { FetchError, fetchHtml } from "./fetcher.ts";
import { cleanHtml } from "./html-cleaner.ts";

// ── Safety limits ────────────────────────────────────────────────────────

/** Maximum size of cleaned HTML sent to the LLM (~100k tokens) */
const MAX_CLEANED_BYTES = 400_000;

export default function (pi: ExtensionAPI) {
	// ══════════════════════════════════════════════════════════════════════════
	// LLM tool: spider_clean
	// Called by Pi itself when the LLM decides to analyze a page
	// ══════════════════════════════════════════════════════════════════════════
	pi.registerTool({
		name: "spider_clean",
		label: "Spider Clean HTML",
		description:
			"Downloads or reads an HTML page, strips scripts/styles/SVG and parasitic attributes, " +
			"then returns lightweight structural HTML for generating Scrapy selectors. " +
			"Can optionally include the content of a spider template file.",
		promptSnippet:
			"Clean an HTML page for Scrapy CSS/XPath selector extraction",
		promptGuidelines: [
			"Use spider_clean when the user asks to generate or complete a Scrapy spider from a web page URL or local HTML file.",
			"Use spider_clean before writing any CSS or XPath selectors — never guess selectors without seeing the HTML first.",
		],
		parameters: Type.Object({
			source: Type.String({
				description: "HTTPS URL or local file path to the HTML page",
			}),
			level: StringEnum(["light", "normal", "aggressive"] as const, {
				description:
					"Cleaning level: " +
					"light = scripts/styles/SVG only | " +
					"normal = + attribute filtering (default) | " +
					"aggressive = + product zone extraction only",
			}),
			template: Type.Optional(
				Type.String({
					description:
						"Path to the Scrapy spider template file (relative to Pi cwd)",
				}),
			),
			prompt: Type.Optional(
				Type.String({
					description:
						"Custom prompt for spider generation (replaces the default). Can be inline text or a path to a prompt file (resolved relative to Pi cwd).",
				}),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			// ── 1. Fetch HTML ──────────────────────────────────────────────
			onUpdate?.({
				content: [{ type: "text", text: `⏳ Fetching ${params.source}…` }],
			});

			let raw: string;
			try {
				raw = await fetchHtml(params.source, ctx.cwd, signal);
			} catch (err) {
				throw new Error(
					err instanceof FetchError
						? err.message
						: `Unexpected error during fetch: ${(err as Error).message}`,
				);
			}

			// ── 2. Clean HTML ─────────────────────────────────────────────
			onUpdate?.({
				content: [
					{ type: "text", text: `🧹 Cleaning HTML (mode: ${params.level})…` },
				],
			});

			const result = cleanHtml(
				raw,
				params.level as "light" | "normal" | "aggressive",
			);

			// ── 3. Safety truncation ──────────────────────────────────────
			let { html } = result;
			let truncated = false;
			if (Buffer.byteLength(html, "utf8") > MAX_CLEANED_BYTES) {
				html = Buffer.from(html, "utf8")
					.slice(0, MAX_CLEANED_BYTES)
					.toString("utf8");
				truncated = true;
			}

			// ── 4. Read template (optional) ───────────────────────────────
			let templateContent = "";
			if (params.template) {
				const absPath = resolve(ctx.cwd, params.template);
				try {
					templateContent = await readFile(absPath, "utf8");
				} catch {
					throw new Error(`Template not found: ${absPath}`);
				}
			}

			// ── 5. Build response ─────────────────────────────────────────
			const stats =
				`📊 HTML: ${fmt(result.sizeBefore)} → ${fmt(result.sizeAfter)} ` +
				`(−${result.reductionPercent}%)` +
				(truncated
					? ` ⚠️ truncated to ${fmt(MAX_CLEANED_BYTES)} for LLM context`
					: "");

			const parts: string[] = [stats];

			if (templateContent) {
				parts.push(
					`## Scrapy spider template\n\`\`\`python\n${templateContent}\n\`\`\``,
				);
			}

			parts.push(`## Cleaned HTML\n\`\`\`html\n${html}\n\`\`\``);

			return {
				content: [{ type: "text", text: parts.join("\n\n") }],
				details: {
					source: params.source,
					level: params.level,
					sizeBefore: result.sizeBefore,
					sizeAfter: result.sizeAfter,
					reductionPercent: result.reductionPercent,
					truncated,
					hasTemplate: !!templateContent,
				},
			};
		},
	});

	// ══════════════════════════════════════════════════════════════════════════
	// Command /spider-create
	// Invoked by the user directly from Pi
	// ══════════════════════════════════════════════════════════════════════════
	pi.registerCommand("spider-create", {
		description:
			"Generate a Scrapy spider from a URL or local HTML page.\n" +
			"Usage: /spider-create url=<url_or_path> [template=<path>] [level=light|normal|aggressive] [prompt=<text_or_path>]",

		handler: async (args, ctx) => {
			let parsed: {
				source: string;
				level: string;
				template?: string;
				prompt?: string;
			};
			try {
				parsed = parseSpiderArgs(args ?? "");
			} catch (err) {
				if (err instanceof ArgParseError) {
					ctx.ui.notify(err.message, "error");
					return;
				}
				throw err;
			}

			const { source, level, template, prompt: rawPrompt } = parsed;
			ctx.ui.notify(`🕷️  Generating spider from ${source}…`, "info");

			// Wait for Pi to be idle before triggering the LLM
			await ctx.waitForIdle();

			// Resolve prompt: file path → read content, otherwise use as-is
			const promptText = rawPrompt
				? await resolvePrompt(rawPrompt, ctx.cwd)
				: null;

			const prompt = buildSpiderPrompt(
				source,
				level,
				template,
				promptText ?? undefined,
			);

			pi.sendUserMessage(prompt, { deliverAs: "followUp" });
		},
	});
}

// ── Utility ─────────────────────────────────────────────────────────────

export function buildSpiderPrompt(
	source: string,
	level: string,
	template?: string,
	customPrompt?: string,
): string {
	const templateClause = template ? `, template="${template}"` : "";
	const defaultPrompt =
		`Use the spider_clean tool with source="${source}", level="${level}"${templateClause}. ` +
		`Then generate a complete Python Scrapy spider that extracts all product fields ` +
		`available on this page (name, price, description, images, SKU, availability, brand…). ` +
		`Use robust CSS or XPath selectors based on the cleaned HTML. ` +
		`The spider must inherit from scrapy.Spider, define a Scrapy Item with all found fields, ` +
		`and include comments explaining each selector.`;

	if (!customPrompt) return defaultPrompt;

	return customPrompt
		.replaceAll("{source}", source)
		.replaceAll("{level}", level)
		.replaceAll("{templateClause}", templateClause);
}

function fmt(bytes: number): string {
	if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
	if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)}KB`;
	return `${bytes}B`;
}
