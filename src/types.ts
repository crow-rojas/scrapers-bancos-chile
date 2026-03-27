import { z } from "zod";

export const TransactionDataSchema = z.object({
  amount: z.number().describe("Transaction amount as a positive number"),
  currency: z
    .enum(["CLP", "USD", "EUR"])
    .default("CLP")
    .describe("Currency code"),
  merchant: z.string().describe("Name of the merchant or store"),
  bank: z.enum(["banco-chile", "santander", "falabella"]),
  cardLast4: z.string().describe("Last 4 digits of the credit card"),
  date: z.coerce.date().describe("Transaction date"),
  installments: z
    .number()
    .optional()
    .describe("Number of installments if applicable"),
  description: z.string().optional().describe("Additional transaction details"),
});

export type TransactionData = z.infer<typeof TransactionDataSchema>;

export type BankId = "banco-chile" | "santander" | "falabella";

export interface BankCredentials {
  username: string;
  password: string;
  securityQuestions?: Record<string, string>;
  totpSecret?: string;
}

export interface ScraperOptions {
  /** LLM API key for Stagehand (BYOK) */
  llmApiKey: string;
  /** LLM provider (default: "anthropic") */
  llmProvider?: "anthropic" | "openai";
  /** LLM model override (e.g. "claude-sonnet-4-20250514", "gpt-4.1-mini") */
  llmModel?: string;
  /** Run browser in headless mode (default: false for development) */
  headless?: boolean;
  /** Timeout in ms for the entire scrape session (default: 120000) */
  timeout?: number;
  /** Directory for Stagehand action cache (default: ".stagehand-cache") */
  cacheDir?: string;
  /** Callback for when the bank requests an SMS OTP code */
  onOtpRequired?: () => Promise<string>;
  /** Stagehand verbosity: 0=quiet, 1=normal, 2=debug (default: 0) */
  verbose?: 0 | 1 | 2;
}

export interface ScrapeResult {
  bank: BankId;
  transactions: TransactionData[];
  scrapedAt: Date;
  success: boolean;
  error?: string;
}
