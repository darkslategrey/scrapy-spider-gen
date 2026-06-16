import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ArgParseError, parseSpiderArgs, resolvePrompt } from "./arg-parser.ts";

describe("parseSpiderArgs — nominal cases", () => {
	it("parses url= alone", () => {
		const result = parseSpiderArgs("url=https://shop.example.com/product/42");
		expect(result.source).toBe("https://shop.example.com/product/42");
		expect(result.level).toBe("normal");
		expect(result.template).toBeUndefined();
		expect(result.prompt).toBeUndefined();
	});

	it("accepts source= as alias for url=", () => {
		const result = parseSpiderArgs("source=https://shop.example.com");
		expect(result.source).toBe("https://shop.example.com");
	});

	it("parses url= + template=", () => {
		const result = parseSpiderArgs(
			"url=https://shop.example.com template=./spider.py",
		);
		expect(result.source).toBe("https://shop.example.com");
		expect(result.template).toBe("./spider.py");
	});

	it("parses url= + level=light", () => {
		const result = parseSpiderArgs("url=https://shop.example.com level=light");
		expect(result.level).toBe("light");
	});

	it("parses url= + level=aggressive", () => {
		const result = parseSpiderArgs(
			"url=https://shop.example.com level=aggressive",
		);
		expect(result.level).toBe("aggressive");
	});

	it("parses url= + prompt= with inline text (single word)", () => {
		const result = parseSpiderArgs(
			"url=https://shop.example.com prompt=ExtractPrice",
		);
		expect(result.prompt).toBe("ExtractPrice");
	});

	it("truncates multi-word prompt at first space (use file for long prompts)", () => {
		const result = parseSpiderArgs(
			"url=https://shop.example.com prompt=Extract only the price",
		);
		expect(result.prompt).toBe("Extract");
	});

	it("parses url= + prompt= with a file path", () => {
		const result = parseSpiderArgs(
			"url=https://shop.example.com prompt=./my_prompt.txt",
		);
		expect(result.prompt).toBe("./my_prompt.txt");
	});

	it("parses all parameters in any order", () => {
		const result = parseSpiderArgs(
			"prompt=./p.txt template=./my_spider.py level=aggressive url=https://shop.example.com/p/123",
		);
		expect(result.source).toBe("https://shop.example.com/p/123");
		expect(result.level).toBe("aggressive");
		expect(result.template).toBe("./my_spider.py");
		expect(result.prompt).toBe("./p.txt");
	});

	it("accepts a local file path as source", () => {
		const result = parseSpiderArgs("url=./pages/product.html");
		expect(result.source).toBe("./pages/product.html");
	});

	it("accepts an absolute path as source", () => {
		const result = parseSpiderArgs("url=/tmp/product_page.html");
		expect(result.source).toBe("/tmp/product_page.html");
	});
});

describe("parseSpiderArgs — expected errors", () => {
	it("throws ArgParseError if url is missing", () => {
		expect(() => parseSpiderArgs("")).toThrow(ArgParseError);
		expect(() => parseSpiderArgs("level=normal")).toThrow(ArgParseError);
		expect(() => parseSpiderArgs("template=./spider.py")).toThrow(
			ArgParseError,
		);
	});

	it("error message contains a usage example", () => {
		try {
			parseSpiderArgs("");
			expect.fail("Should throw an error");
		} catch (err) {
			expect(err).toBeInstanceOf(ArgParseError);
			expect((err as ArgParseError).message).toContain("/spider-create url=");
		}
	});

	it("throws ArgParseError if level is invalid", () => {
		expect(() =>
			parseSpiderArgs("url=https://shop.example.com level=ultra"),
		).toThrow(ArgParseError);
	});

	it("error message for invalid level lists accepted values", () => {
		try {
			parseSpiderArgs("url=https://shop.example.com level=ultra");
			expect.fail("Should throw an error");
		} catch (err) {
			expect((err as ArgParseError).message).toContain("light");
			expect((err as ArgParseError).message).toContain("normal");
			expect((err as ArgParseError).message).toContain("aggressive");
		}
	});

	it("throws ArgParseError on a string without = separator", () => {
		expect(() => parseSpiderArgs("https://shop.example.com")).toThrow(
			ArgParseError,
		);
	});
});

describe("parseSpiderArgs — robustness", () => {
	it("tolerates multiple spaces between arguments", () => {
		const result = parseSpiderArgs(
			"url=https://shop.example.com   level=light   template=./s.py",
		);
		expect(result.source).toBe("https://shop.example.com");
		expect(result.level).toBe("light");
		expect(result.template).toBe("./s.py");
	});

	it("tolerates leading and trailing spaces", () => {
		const result = parseSpiderArgs("  url=https://shop.example.com  ");
		expect(result.source).toBe("https://shop.example.com");
	});

	it("url= takes priority over source= when both are present", () => {
		const result = parseSpiderArgs(
			"source=https://fallback.com url=https://primary.com",
		);
		expect(result.source).toBe("https://primary.com");
	});
});

// ── resolvePrompt ────────────────────────────────────────────────────────

describe("resolvePrompt", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = join(tmpdir(), `spider-prompt-test-${Date.now()}`);
		await mkdir(tmpDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	it("returns the string as-is when it is not a file path", async () => {
		const result = await resolvePrompt("Extract only the price", tmpDir);
		expect(result).toBe("Extract only the price");
	});

	it("reads file content when the value is an existing file path", async () => {
		const promptFile = join(tmpDir, "my_prompt.txt");
		await writeFile(promptFile, "Custom prompt from file", "utf8");

		const result = await resolvePrompt("my_prompt.txt", tmpDir);
		expect(result).toBe("Custom prompt from file");
	});

	it("reads file content for an absolute path", async () => {
		const promptFile = join(tmpDir, "abs_prompt.txt");
		await writeFile(promptFile, "Absolute path prompt", "utf8");

		const result = await resolvePrompt(promptFile, tmpDir);
		expect(result).toBe("Absolute path prompt");
	});

	it("returns the string as-is when the file does not exist", async () => {
		const result = await resolvePrompt("./nonexistent.txt", tmpDir);
		expect(result).toBe("./nonexistent.txt");
	});

	it("returns the string as-is for a path that looks like a file but is not", async () => {
		const result = await resolvePrompt("./prompts/custom.txt", tmpDir);
		expect(result).toBe("./prompts/custom.txt");
	});
});
