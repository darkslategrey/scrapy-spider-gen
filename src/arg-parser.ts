import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface SpiderArgs {
	source: string;
	level: "light" | "normal" | "aggressive";
	template?: string;
	prompt?: string;
}

export class ArgParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ArgParseError";
	}
}

const VALID_LEVELS = new Set(["light", "normal", "aggressive"]);

/**
 * Parse the argument string of the /spider-create command.
 *
 * Expected format: url=<url> [template=<path>] [level=light|normal|aggressive] [prompt=<text_or_path>]
 * Accepted aliases: source= for url=
 *
 * @throws ArgParseError if arguments are invalid
 */
export function parseSpiderArgs(raw: string): SpiderArgs {
	const pairs = Object.fromEntries(
		(raw ?? "")
			.trim()
			.split(/\s+/)
			.filter((token) => token.includes("="))
			.map((token) => {
				const idx = token.indexOf("=");
				return [token.slice(0, idx), token.slice(idx + 1)] as [string, string];
			}),
	);

	const source = pairs.url ?? pairs.source ?? "";
	if (!source) {
		throw new ArgParseError(
			"Missing argument: url=<url_or_path>\n" +
				"Example: /spider-create url=https://shop.example.com/product/42 template=./spider.py level=normal prompt=./my_prompt.txt",
		);
	}

	const rawLevel = pairs.level ?? "normal";
	if (!VALID_LEVELS.has(rawLevel)) {
		throw new ArgParseError(
			`Invalid level: "${rawLevel}". Accepted values: light, normal, aggressive`,
		);
	}

	return {
		source,
		level: rawLevel as SpiderArgs["level"],
		template: pairs.template,
		prompt: pairs.prompt,
	};
}

/**
 * Resolve a prompt value: if it's a file path that exists on disk, read its
 * content. Otherwise treat the value as an inline prompt string.
 */
export async function resolvePrompt(
	value: string,
	cwd: string,
): Promise<string> {
	const absPath = resolve(cwd, value);
	try {
		await access(absPath);
		return await readFile(absPath, "utf8");
	} catch {
		// Not a file — treat as inline prompt text
		return value;
	}
}
