import { BaseScraper } from "./base-scraper.js";
import { registerScraper } from "./scraper-factory.js";
import type { BankCredentials, BankId, TransactionData } from "./types.js";

export class SantanderScraper extends BaseScraper {
  readonly bankId: BankId = "santander";
  readonly bankUrl = "https://banco.santander.cl/personas";

  protected async execute(
    _credentials: BankCredentials,
    _dateRange?: { from: Date; to: Date },
  ): Promise<TransactionData[]> {
    // TODO: Implement following same pattern as BancoChileScraper
    throw new Error("SantanderScraper not yet implemented");
  }
}

registerScraper("santander", SantanderScraper);
