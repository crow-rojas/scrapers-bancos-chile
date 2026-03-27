import type { BankId, ScraperOptions } from "./types.js";
import type { BaseScraper } from "./base-scraper.js";

type ScraperConstructor = new (options: ScraperOptions) => BaseScraper;

const registry = new Map<BankId, ScraperConstructor>();

export function registerScraper(
  bankId: BankId,
  constructor: ScraperConstructor
): void {
  registry.set(bankId, constructor);
}

export function createScraper(
  bankId: BankId,
  options: ScraperOptions
): BaseScraper {
  const Constructor = registry.get(bankId);
  if (!Constructor) {
    const available = Array.from(registry.keys()).join(", ");
    throw new Error(
      `No scraper registered for bank "${bankId}". Available: ${available || "none"}`
    );
  }
  return new Constructor(options);
}

export function getAvailableBanks(): BankId[] {
  return Array.from(registry.keys());
}
