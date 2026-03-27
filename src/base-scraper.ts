import { Stagehand } from "@browserbasehq/stagehand";
import type {
  BankCredentials,
  BankId,
  ScraperOptions,
  ScrapeResult,
  TransactionData,
} from "./types.js";

export abstract class BaseScraper {
  protected readonly options: ScraperOptions;

  constructor(options: ScraperOptions) {
    this.options = options;
  }

  abstract readonly bankId: BankId;
  abstract readonly bankUrl: string;

  async scrape(
    credentials: BankCredentials,
    dateRange?: { from: Date; to: Date },
  ): Promise<ScrapeResult> {
    const scrapedAt = new Date();
    try {
      const transactions = await this.execute(credentials, dateRange);
      return {
        bank: this.bankId,
        transactions,
        scrapedAt,
        success: true,
      };
    } catch (error) {
      return {
        bank: this.bankId,
        transactions: [],
        scrapedAt,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  protected async createStagehand(): Promise<Stagehand> {
    const provider = this.options.llmProvider ?? "anthropic";
    const model = this.options.llmModel
      ? `${provider}/${this.options.llmModel}`
      : provider === "anthropic"
        ? "anthropic/claude-sonnet-4-20250514"
        : "openai/gpt-4.1-mini";

    const stagehand = new Stagehand({
      env: "LOCAL",
      model: {
        modelName: model,
        apiKey: this.options.llmApiKey,
      },
      selfHeal: true,
      cacheDir: this.options.cacheDir,
      verbose: this.options.verbose ?? 0,
      localBrowserLaunchOptions: {
        headless: this.options.headless ?? false,
        args: [
          "--window-position=-2400,-2400",  // off-screen so it doesn't steal focus
          "--window-size=1280,720",
        ],
      },
    });
    await stagehand.init();
    return stagehand;
  }

  protected abstract execute(
    credentials: BankCredentials,
    dateRange?: { from: Date; to: Date },
  ): Promise<TransactionData[]>;
}
