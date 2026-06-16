import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export class FetchError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
	) {
		super(message);
		this.name = "FetchError";
	}
}

/**
 * Determines whether the source is a URL or a file path,
 * then returns the corresponding raw HTML.
 */
export async function fetchHtml(
	source: string,
	cwd: string = process.cwd(),
	signal?: AbortSignal,
): Promise<string> {
	if (isUrl(source)) {
		return fetchFromUrl(source, signal);
	}
	return readFromFile(source, cwd);
}

export function isUrl(source: string): boolean {
	return source.startsWith("http://") || source.startsWith("https://");
}

async function fetchFromUrl(
	url: string,
	signal?: AbortSignal,
): Promise<string> {
	let response: Response;
	try {
		response = await fetch(url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; scrapy-spider-gen/1.0; +https://github.com/earendil-works/pi)",
				Accept: "text/html,application/xhtml+xml",
				"Accept-Language": "en,fr;q=0.9",
			},
			signal,
		});
	} catch (err) {
		throw new FetchError(`Unable to reach ${url}: ${(err as Error).message}`);
	}

	if (!response.ok) {
		throw new FetchError(
			`HTTP ${response.status} ${response.statusText} for ${url}`,
			response.status,
		);
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (
		!contentType.includes("html") &&
		!contentType.includes("xml") &&
		contentType !== ""
	) {
		throw new FetchError(
			`Unexpected Content-Type: "${contentType}" (expected text/html)`,
		);
	}

	return response.text();
}

async function readFromFile(source: string, cwd: string): Promise<string> {
	const absPath = resolve(cwd, source);
	try {
		await access(absPath);
	} catch {
		throw new FetchError(`File not found: ${absPath}`);
	}
	return readFile(absPath, "utf8");
}
