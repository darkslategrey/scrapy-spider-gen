import { describe, expect, it } from "vitest";
import { ArgParseError, parseSpiderArgs } from "./arg-parser.ts";

describe("parseSpiderArgs — nominal cases", () => {
	it("parses url= alone", () => {
		const result = parseSpiderArgs("url=https://shop.example.com/product/42");
		expect(result.source).toBe("https://shop.example.com/product/42");
		expect(result.level).toBe("normal");
		expect(result.template).toBeUndefined();
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

	it("parses url= + level= + template= in any order", () => {
		const result = parseSpiderArgs(
			"template=./my_spider.py level=aggressive url=https://shop.example.com/p/123",
		);
		expect(result.source).toBe("https://shop.example.com/p/123");
		expect(result.level).toBe("aggressive");
		expect(result.template).toBe("./my_spider.py");
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
