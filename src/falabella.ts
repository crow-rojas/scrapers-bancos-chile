import { BaseScraper } from "./base-scraper.js";
import { registerScraper } from "./scraper-factory.js";
import type { BankCredentials, BankId, TransactionData } from "./types.js";

export class FalabellaScraper extends BaseScraper {
  readonly bankId: BankId = "falabella";
  readonly bankUrl = "https://www.bancofalabella.cl/";

  protected async execute(
    _credentials: BankCredentials,
    _dateRange?: { from: Date; to: Date },
  ): Promise<TransactionData[]> {
    // TODO: Implement following same pattern as BancoChileScraper
    throw new Error("FalabellaScraper not yet implemented");
  }
}

registerScraper("falabella", FalabellaScraper);
