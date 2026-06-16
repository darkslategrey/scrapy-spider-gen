import { describe, expect, it } from "vitest";
import { cleanHtml } from "./html-cleaner.ts";

// ── Realistic test HTML (simplified vaping product page) ──────────────────

const PRODUCT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pod Kit 3000 | VapeShop</title>
  <link rel="stylesheet" href="/css/app.css">
  <style>body { font-family: sans-serif; } .hidden { display:none; }</style>
  <script>
    window.dataLayer = window.dataLayer || [];
    gtag('config', 'UA-123456');
  </script>
  <script src="/js/analytics.bundle.min.js"></script>
  <script src="/js/app.chunk.js" defer></script>
</head>
<body>
  <!-- Navigation -->
  <nav data-tracking="nav-top" style="background:#fff">
    <a href="/" style="color:red">Home</a>
  </nav>

  <!-- Main product zone -->
  <main id="main-content">
    <div class="product-detail" itemscope itemtype="https://schema.org/Product">
      <h1 class="product-name" itemprop="name" data-product-id="P42">Pod Kit 3000</h1>

      <div class="product-images" data-gallery="true">
        <img src="/img/pod-kit-3000-main.jpg" alt="Pod Kit 3000 front view"
             loading="lazy" fetchpriority="high" decoding="async">
        <img src="/img/pod-kit-3000-side.jpg" alt="Pod Kit 3000 side view"
             loading="lazy">
      </div>

      <div class="product-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <span class="price-current" itemprop="price" content="34.90" data-price="34.90">34,90 €</span>
        <span class="price-currency" itemprop="priceCurrency" content="EUR">EUR</span>
        <span class="price-old">49,90 €</span>
      </div>

      <div class="product-sku">
        <span class="label">SKU:</span>
        <span class="sku-value" data-sku="PKT-3000-BLK">PKT-3000-BLK</span>
      </div>

      <div class="product-stock">
        <span class="stock-badge in-stock" data-stock="available">In stock</span>
      </div>

      <div class="product-brand">
        <a href="/brands/vaportech" itemprop="brand">VaporTech</a>
      </div>

      <div class="product-description" itemprop="description">
        <p>The Pod Kit 3000 offers 1500 mAh battery life and a 0.6Ω resistance.</p>
        <ul>
          <li>Capacity: 2ml</li>
          <li>Power: 5-25W</li>
        </ul>
      </div>

      <!-- Inline SVG (icon) -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      </svg>

      <button class="btn-add-to-cart"
              data-product-id="P42"
              onclick="addToCart(42)"
              style="background:#0070f3; padding:16px">
        Add to cart
      </button>
    </div>
  </main>

  <!-- Verbose footer -->
  <footer class="site-footer" style="padding:40px">
    <div class="footer-links">
      <a href="/legal">Legal notices</a>
      <a href="/terms">Terms of service</a>
    </div>
    <p>&copy; 2024 VapeShop. All rights reserved.</p>
  </footer>

  <script>
    // React hydration
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App, { productId: 42 }));
  </script>
  <noscript>Enable JavaScript.</noscript>
</body>
</html>`;

// ── Suite: "light" level cleaning ─────────────────────────────────────────

describe("cleanHtml — light level", () => {
	it("removes all <script> tags", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "light");
		expect(html).not.toContain("<script");
		expect(html).not.toContain("gtag(");
		expect(html).not.toContain("ReactDOM");
	});

	it("removes <style> tags", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "light");
		expect(html).not.toContain("<style");
		expect(html).not.toContain("font-family");
	});

	it("removes inline SVG tags", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "light");
		expect(html).not.toContain("<svg");
		expect(html).not.toContain("<path");
	});

	it("removes <noscript> tags", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "light");
		expect(html).not.toContain("<noscript");
	});

	it("removes <link> tags", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "light");
		expect(html).not.toContain('<link rel="stylesheet"');
	});

	it("preserves text content and structural tags", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "light");
		expect(html).toContain("Pod Kit 3000");
		expect(html).toContain("34,90 €");
		expect(html).toContain("In stock");
		expect(html).toContain("VaporTech");
		expect(html).toContain("product-detail");
	});

	it("preserves inline style attributes (not filtered in light)", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "light");
		// In light mode, style attributes are kept
		expect(html).toContain("style=");
	});

	it("returns consistent reduction metrics", () => {
		const result = cleanHtml(PRODUCT_HTML, "light");
		expect(result.sizeBefore).toBeGreaterThan(0);
		expect(result.sizeAfter).toBeLessThan(result.sizeBefore);
		expect(result.reductionPercent).toBeGreaterThan(0);
		expect(result.reductionPercent).toBeLessThanOrEqual(100);
	});
});

// ── Suite: "normal" level cleaning ────────────────────────────────────────

describe("cleanHtml — normal level", () => {
	it("applies all light-level removals", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "normal");
		expect(html).not.toContain("<script");
		expect(html).not.toContain("<style");
		expect(html).not.toContain("<svg");
	});

	it("removes inline style attributes", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "normal");
		expect(html).not.toContain('style="background:#fff"');
		expect(html).not.toContain('style="color:red"');
	});

	it("removes tracking attributes (onclick, fetchpriority…)", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "normal");
		expect(html).not.toContain("onclick=");
		expect(html).not.toContain("fetchpriority=");
		expect(html).not.toContain("decoding=");
	});

	it("preserves id and class attributes", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "normal");
		expect(html).toContain('id="main-content"');
		expect(html).toContain('class="product-detail"');
		expect(html).toContain('class="product-name"');
		expect(html).toContain('class="price-current"');
	});

	it("preserves href and src attributes", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "normal");
		expect(html).toContain('href="/brands/vaportech"');
		expect(html).toContain('src="/img/pod-kit-3000-main.jpg"');
	});

	it("preserves alt attributes on images", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "normal");
		expect(html).toContain('alt="Pod Kit 3000 front view"');
	});

	it("preserves Schema.org attributes (itemprop, itemtype, itemscope)", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "normal");
		expect(html).toContain('itemprop="name"');
		expect(html).toContain('itemprop="price"');
		expect(html).toContain('itemtype="https://schema.org/Product"');
	});

	it("preserves semantic product data-* attributes", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "normal");
		expect(html).toContain('data-product-id="P42"');
		expect(html).toContain('data-price="34.90"');
		expect(html).toContain('data-sku="PKT-3000-BLK"');
		expect(html).toContain('data-stock="available"');
	});

	it("removes non-relevant data-* attributes", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "normal");
		expect(html).not.toContain("data-tracking=");
		expect(html).not.toContain("data-gallery=");
	});

	it("preserves important text content", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "normal");
		expect(html).toContain("Pod Kit 3000");
		expect(html).toContain("34,90 €");
		expect(html).toContain("PKT-3000-BLK");
		expect(html).toContain("In stock");
		expect(html).toContain("1500 mAh");
	});

	it("reduces more than the light level", () => {
		const light = cleanHtml(PRODUCT_HTML, "light");
		const normal = cleanHtml(PRODUCT_HTML, "normal");
		expect(normal.sizeAfter).toBeLessThan(light.sizeAfter);
	});
});

// ── Suite: "aggressive" level cleaning ────────────────────────────────────

describe("cleanHtml — aggressive level", () => {
	it("extracts only the main product zone", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "aggressive");
		// Must contain product content
		expect(html).toContain("Pod Kit 3000");
		expect(html).toContain("34,90 €");
	});

	it("excludes the footer", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "aggressive");
		expect(html).not.toContain("Legal notices");
		expect(html).not.toContain("All rights reserved");
	});

	it("excludes navigation", () => {
		const { html } = cleanHtml(PRODUCT_HTML, "aggressive");
		expect(html).not.toContain("<nav");
	});

	it("reduces more than the normal level", () => {
		const normal = cleanHtml(PRODUCT_HTML, "normal");
		const aggressive = cleanHtml(PRODUCT_HTML, "aggressive");
		expect(aggressive.sizeAfter).toBeLessThan(normal.sizeAfter);
	});

	it("returns something even if no product zone is found", () => {
		const minimal = "<html><body><p>Nothing special here.</p></body></html>";
		const { html } = cleanHtml(minimal, "aggressive");
		expect(html.length).toBeGreaterThan(0);
	});
});

// ── Suite: edge cases ─────────────────────────────────────────────────────

describe("cleanHtml — edge cases", () => {
	it("handles an empty string without throwing", () => {
		const result = cleanHtml("", "normal");
		expect(result.html).toBe("");
		expect(result.sizeBefore).toBe(0);
		expect(result.sizeAfter).toBe(0);
		expect(result.reductionPercent).toBe(0);
	});

	it("handles an HTML fragment without structural tags", () => {
		const fragment = '<p class="price">29,90 €</p>';
		const { html } = cleanHtml(fragment, "normal");
		expect(html).toContain("29,90 €");
		expect(html).toContain('class="price"');
	});

	it("handles HTML with only scripts (returns empty)", () => {
		const onlyScripts =
			"<html><head><script>alert(1)</script></head><body></body></html>";
		const { html } = cleanHtml(onlyScripts, "normal");
		expect(html).not.toContain("<script");
	});

	it("does not crash on HTML with special encodings", () => {
		const withEntities =
			'<p class="desc">Price &amp; availability &lt;check&gt;</p>';
		expect(() => cleanHtml(withEntities, "normal")).not.toThrow();
		const { html } = cleanHtml(withEntities, "normal");
		expect(html).toContain("Price");
	});

	it("uses normal as the default level", () => {
		const withDefault = cleanHtml(PRODUCT_HTML);
		const withNormal = cleanHtml(PRODUCT_HTML, "normal");
		expect(withDefault.html).toBe(withNormal.html);
	});

	it("reduction is >= 0 and <= 100", () => {
		const inputs = [PRODUCT_HTML, "", "<p>text</p>", "<script>x=1</script>"];
		for (const input of inputs) {
			const result = cleanHtml(input, "normal");
			expect(result.reductionPercent).toBeGreaterThanOrEqual(0);
			expect(result.reductionPercent).toBeLessThanOrEqual(100);
		}
	});
});
