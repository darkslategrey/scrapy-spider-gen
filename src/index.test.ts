import { describe, expect, it } from "vitest";
import { buildSpiderPrompt } from "./index.ts";

describe("buildSpiderPrompt", () => {
	it("returns the default prompt when no custom prompt is provided", () => {
		const prompt = buildSpiderPrompt(
			"https://shop.example.com/product/42",
			"normal",
		);
		expect(prompt).toContain("spider_clean");
		expect(prompt).toContain("https://shop.example.com/product/42");
		expect(prompt).toContain('level="normal"');
		expect(prompt).toContain("scrapy.Spider");
	});

	it("includes template clause when template is provided", () => {
		const prompt = buildSpiderPrompt(
			"https://shop.example.com/product/42",
			"normal",
			"./spider.py",
		);
		expect(prompt).toContain('template="./spider.py"');
	});

	it("replaces default prompt entirely when custom prompt is provided", () => {
		const custom = "Extract only the price using XPath";
		const prompt = buildSpiderPrompt(
			"https://shop.example.com/product/42",
			"normal",
			undefined,
			custom,
		);
		expect(prompt).toBe(custom);
		expect(prompt).not.toContain("spider_clean");
		expect(prompt).not.toContain("scrapy.Spider");
	});

	it("replaces default prompt even when template is provided", () => {
		const custom = "My custom instructions";
		const prompt = buildSpiderPrompt(
			"https://shop.example.com/product/42",
			"aggressive",
			"./spider.py",
			custom,
		);
		expect(prompt).toBe(custom);
		expect(prompt).not.toContain("template=");
	});

	it("replaces default prompt with multi-line content", () => {
		const custom = [
			"Extract only the product price.",
			"Ignore all promotional banners.",
			"Use XPath selectors.",
		].join("\n");
		const prompt = buildSpiderPrompt(
			"https://shop.example.com/product/42",
			"normal",
			undefined,
			custom,
		);
		expect(prompt).toBe(custom);
		expect(prompt).toContain("Extract only the product price.");
		expect(prompt).toContain("Ignore all promotional banners.");
	});
});
