export { createScraper, getAvailableBanks, registerScraper } from "./scraper-factory.js";
export { BaseScraper } from "./base-scraper.js";
export {
  TransactionDataSchema,
  type TransactionData,
  type BankId,
  type BankCredentials,
  type ScraperOptions,
  type ScrapeResult,
} from "./types.js";

// Register all built-in scrapers
import "./banco-chile.js";
import "./santander.js";
import "./falabella.js";
