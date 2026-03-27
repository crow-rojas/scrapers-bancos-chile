import { z } from "zod";
import type { Stagehand } from "@browserbasehq/stagehand";
import { BaseScraper } from "./base-scraper.js";
import { registerScraper } from "./scraper-factory.js";
import type {
  BankCredentials,
  BankId,
  TransactionData,
} from "./types.js";

const CreditCardTransactionSchema = z.array(
  z.object({
    date: z.string().describe("Transaction date in DD/MM/YYYY or similar format"),
    merchant: z.string().describe("Name of the merchant or commerce"),
    amount: z.number().describe("Transaction amount as a positive number in CLP"),
    installments: z
      .number()
      .optional()
      .describe("Number of installments (cuotas) if shown"),
    currency: z.string().optional().describe("Currency if not CLP"),
  }),
);

export class BancoChileScraper extends BaseScraper {
  readonly bankId: BankId = "banco-chile";
  readonly bankUrl = "https://portalpersonas.bancochile.cl/mibancochile/";

  protected async execute(
    credentials: BankCredentials,
    _dateRange?: { from: Date; to: Date },
  ): Promise<TransactionData[]> {
    const stagehand = await this.createStagehand();

    try {
      const page = stagehand.context.pages()[0];
      await page.goto(this.bankUrl, { waitUntil: "networkidle" });

      // Login — credentials injected via variables (never sent to LLM)
      await stagehand.act("type %username% into the RUT or username field", {
        variables: { username: credentials.username },
      });
      await stagehand.act("type %password% into the password or clave field", {
        variables: { password: credentials.password },
      });
      await stagehand.act("click the login or 'ingresar' button");

      // Handle potential 2FA or security questions
      await this.handle2FA(stagehand, credentials);

      // Navigate to credit card transactions
      await stagehand.act(
        "navigate to credit card section, look for 'tarjetas de crédito' or 'tarjetas' in the menu",
      );
      await stagehand.act(
        "click on 'últimos movimientos' or 'movimientos' or 'cartola' to see recent credit card transactions",
      );

      // Extract transactions
      const rawTransactions = await stagehand.extract(
        "extract all credit card transactions visible on the page. Each transaction should have a date, merchant name, amount, and optionally the number of installments (cuotas)",
        CreditCardTransactionSchema,
      );

      // Also try to extract card info
      const cardInfo = await stagehand.extract(
        "extract the last 4 digits of the credit card number shown on the page",
        z.object({ cardLast4: z.string().describe("Last 4 digits of credit card") }),
      ).catch(() => ({ cardLast4: "0000" }));

      // Logout
      await stagehand.act("click on logout, 'salir', or 'cerrar sesión'").catch(() => {
        // Best effort logout
      });

      return rawTransactions.map((tx) => ({
        amount: tx.amount,
        currency: (tx.currency as "CLP" | "USD" | "EUR") ?? "CLP",
        merchant: tx.merchant,
        bank: this.bankId,
        cardLast4: cardInfo.cardLast4,
        date: this.parseDate(tx.date),
        installments: tx.installments,
      }));
    } finally {
      await stagehand.close();
    }
  }

  private async handle2FA(
    stagehand: Stagehand,
    credentials: BankCredentials,
  ): Promise<void> {
    // Check if there's a security question or 2FA prompt
    const pageState = await stagehand
      .extract(
        "Is there a security question, OTP input, or 2FA challenge visible on the page? If yes, describe what is being asked.",
        z.object({
          has2FA: z.boolean().describe("Whether a 2FA or security challenge is visible"),
          challengeType: z
            .enum(["security_question", "sms_otp", "totp", "none"])
            .describe("Type of challenge"),
          questionText: z
            .string()
            .optional()
            .describe("The security question text if applicable"),
        }),
      )
      .catch(() => ({ has2FA: false, challengeType: "none" as const, questionText: undefined }));

    if (!pageState.has2FA || pageState.challengeType === "none") {
      return;
    }

    if (
      pageState.challengeType === "security_question" &&
      pageState.questionText &&
      credentials.securityQuestions
    ) {
      const answer = credentials.securityQuestions[pageState.questionText];
      if (answer) {
        await stagehand.act("type %answer% into the security question answer field", {
          variables: { answer },
        });
        await stagehand.act("click the submit or continue button");
      }
    }

    if (pageState.challengeType === "sms_otp" && this.options.onOtpRequired) {
      const otpCode = await this.options.onOtpRequired();
      await stagehand.act("type %otp% into the OTP or verification code field", {
        variables: { otp: otpCode },
      });
      await stagehand.act("click the submit or verify button");
    }
  }

  private parseDate(dateStr: string): Date {
    // Handle DD/MM/YYYY format common in Chilean banks
    const parts = dateStr.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
    if (parts) {
      const day = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1;
      const year =
        parseInt(parts[3], 10) < 100
          ? 2000 + parseInt(parts[3], 10)
          : parseInt(parts[3], 10);
      return new Date(year, month, day);
    }
    return new Date(dateStr);
  }
}

registerScraper("banco-chile", BancoChileScraper);
