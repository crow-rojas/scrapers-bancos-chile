import { describe, it, expect } from "vitest";
import { BancoChileScraper } from "../src/banco-chile.js";

const mockOptions = {
  llmApiKey: "test-key",
  llmProvider: "anthropic" as const,
  headless: true,
};

describe("BancoChileScraper", () => {
  it("should have correct bankId", () => {
    const scraper = new BancoChileScraper(mockOptions);
    expect(scraper.bankId).toBe("banco-chile");
  });

  it("should have correct bankUrl", () => {
    const scraper = new BancoChileScraper(mockOptions);
    expect(scraper.bankUrl).toContain("bancochile.cl");
  });

  // Integration test — requires real browser + LLM API key
  // Run manually with: LLM_API_KEY=sk-... pnpm test -- --testNamePattern="integration"
  it.skip("integration: should scrape with real credentials", async () => {
    const scraper = new BancoChileScraper({
      llmApiKey: process.env.LLM_API_KEY!,
      llmProvider: "anthropic",
      headless: false,
      verbose: 1,
    });
    const result = await scraper.scrape({
      username: process.env.BANCO_CHILE_RUT!,
      password: process.env.BANCO_CHILE_PASSWORD!,
    });
    console.log("Result:", JSON.stringify(result, null, 2));
    expect(result.bank).toBe("banco-chile");
  });
});
