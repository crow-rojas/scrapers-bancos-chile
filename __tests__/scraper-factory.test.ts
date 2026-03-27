import { describe, it, expect } from "vitest";
import {
  createScraper,
  getAvailableBanks,
  type ScraperOptions,
  type BankId,
} from "../src/index.js";

const mockOptions: ScraperOptions = {
  llmApiKey: "test-key",
  llmProvider: "anthropic",
  headless: true,
};

describe("scraper-factory", () => {
  it("should list all registered banks", () => {
    const banks = getAvailableBanks();
    expect(banks).toContain("banco-chile");
    expect(banks).toContain("santander");
    expect(banks).toContain("falabella");
    expect(banks).toHaveLength(3);
  });

  it("should create a scraper for banco-chile", () => {
    const scraper = createScraper("banco-chile", mockOptions);
    expect(scraper.bankId).toBe("banco-chile");
  });

  it("should create a scraper for santander", () => {
    const scraper = createScraper("santander", mockOptions);
    expect(scraper.bankId).toBe("santander");
  });

  it("should create a scraper for falabella", () => {
    const scraper = createScraper("falabella", mockOptions);
    expect(scraper.bankId).toBe("falabella");
  });

  it("should throw for unknown bank ID", () => {
    expect(() => createScraper("unknown-bank" as BankId, mockOptions)).toThrow(
      /No scraper registered for bank "unknown-bank"/,
    );
  });

  it("should include available banks in error message", () => {
    expect(() => createScraper("nope" as BankId, mockOptions)).toThrow(
      /Available:/,
    );
  });
});
