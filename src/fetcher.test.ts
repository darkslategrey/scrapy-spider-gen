import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FetchError, fetchHtml, isUrl } from "./fetcher.ts";

// ── isUrl ─────────────────────────────────────────────────────────────────

describe("isUrl", () => {
	it("recognizes https:// URLs", () => {
		expect(isUrl("https://shop.example.com")).toBe(true);
	});

	it("recognizes http:// URLs", () => {
		expect(isUrl("http://shop.example.com")).toBe(true);
	});

	it("returns false for a relative path", () => {
		expect(isUrl("./pages/product.html")).toBe(false);
	});

	it("returns false for an absolute path", () => {
		expect(isUrl("/tmp/page.html")).toBe(false);
	});

	it("returns false for an empty string", () => {
		expect(isUrl("")).toBe(false);
	});
});

// ── fetchHtml — local file ────────────────────────────────────────────────

describe("fetchHtml — local file", () => {
	let tmpDir: string;
	let htmlPath: string;

	beforeEach(async () => {
		tmpDir = join(tmpdir(), `scrapy-test-${Date.now()}`);
		await mkdir(tmpDir, { recursive: true });
		htmlPath = join(tmpDir, "product.html");
		await writeFile(
			htmlPath,
			"<html><body><h1>Test Product</h1><p class='price'>19,90 €</p></body></html>",
			"utf8",
		);
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	it("reads a local file via absolute path", async () => {
		const html = await fetchHtml(htmlPath, tmpDir);
		expect(html).toContain("Test Product");
		expect(html).toContain("19,90 €");
	});

	it("reads a local file via path relative to cwd", async () => {
		const html = await fetchHtml("product.html", tmpDir);
		expect(html).toContain("Test Product");
	});

	it("throws FetchError if the file does not exist", async () => {
		await expect(fetchHtml("/nonexistent/file.html", tmpDir)).rejects.toThrow(
			FetchError,
		);
	});

	it("error message for missing file mentions the path", async () => {
		try {
			await fetchHtml("/nonexistent/file.html", tmpDir);
			expect.fail("Should throw an error");
		} catch (err) {
			expect((err as FetchError).message).toContain("/nonexistent/file.html");
		}
	});
});

// ── fetchHtml — remote URL (mocked fetch) ─────────────────────────────────

describe("fetchHtml — remote URL", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns HTML for a 200 text/html response", async () => {
		const mockHtml = "<html><body><h1>Remote Product</h1></body></html>";
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(mockHtml, {
				status: 200,
				headers: { "content-type": "text/html; charset=utf-8" },
			}),
		);

		const html = await fetchHtml("https://shop.example.com/product/1");
		expect(html).toBe(mockHtml);
	});

	it("sends an appropriate User-Agent", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("<html></html>", {
				status: 200,
				headers: { "content-type": "text/html" },
			}),
		);

		await fetchHtml("https://shop.example.com/product/1");

		const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		const headers = options?.headers as Record<string, string>;
		expect(headers["User-Agent"]).toContain("scrapy-spider-gen");
	});

	it("throws FetchError for a 404 response", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("Not Found", { status: 404, statusText: "Not Found" }),
		);

		await expect(fetchHtml("https://shop.example.com/404")).rejects.toThrow(
			FetchError,
		);
	});

	it("statusCode is available in FetchError for a 404", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("Not Found", { status: 404, statusText: "Not Found" }),
		);

		try {
			await fetchHtml("https://shop.example.com/404");
			expect.fail("Should throw an error");
		} catch (err) {
			expect((err as FetchError).statusCode).toBe(404);
		}
	});

	it("throws FetchError for a 500 response", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("Internal Server Error", {
				status: 500,
				statusText: "Internal Server Error",
			}),
		);

		await expect(fetchHtml("https://shop.example.com/error")).rejects.toThrow(
			FetchError,
		);
	});

	it("throws FetchError if fetch fails (network error)", async () => {
		vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));

		await expect(
			fetchHtml("https://shop.example.com/product/1"),
		).rejects.toThrow(FetchError);
	});

	it("throws FetchError if content-type is not HTML", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response('{"price": 29.90}', {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		await expect(fetchHtml("https://api.example.com/product")).rejects.toThrow(
			FetchError,
		);
	});

	it("accepts content-type application/xhtml+xml", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("<html><body>XHTML</body></html>", {
				status: 200,
				headers: { "content-type": "application/xhtml+xml" },
			}),
		);

		const html = await fetchHtml("https://shop.example.com/xhtml");
		expect(html).toContain("XHTML");
	});

	it("passes the AbortSignal to native fetch", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response("<html></html>", {
				status: 200,
				headers: { "content-type": "text/html" },
			}),
		);

		const controller = new AbortController();
		await fetchHtml(
			"https://shop.example.com",
			process.cwd(),
			controller.signal,
		);

		const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
		expect(options?.signal).toBe(controller.signal);
	});
});
