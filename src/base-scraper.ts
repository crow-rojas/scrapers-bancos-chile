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

    const headless = this.options.headless ?? false;

    const args = [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--window-size=1280,720",
    ];

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
        headless,
        args,
      },
    });
    await stagehand.init();

    // Apply runtime stealth evasions to bypass anti-bot detection
    const page = stagehand.context.pages()[0];
    if (page) {
      // addInitScript runs in the browser context, not Node — use string form to avoid TS DOM issues
      await page.addInitScript(`
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-CL', 'es', 'en-US', 'en'] });
        window.chrome = { runtime: {} };
      `);
    }

    return stagehand;
  }

  protected abstract execute(
    credentials: BankCredentials,
    dateRange?: { from: Date; to: Date },
  ): Promise<TransactionData[]>;
}
