import { z } from "zod";
import { BaseScraper } from "./base-scraper.js";
import { registerScraper } from "./scraper-factory.js";
import type {
  BankCredentials,
  BankId,
  TransactionData,
} from "./types.js";

// Schema for extracting transactions from the "Saldos y movimientos no facturados" table
// Example row: 15/03/2026 | Titular*********7832 | SUPERMERCADO JUMBO SANTIAGO CL | SANTIAGO | 01/03 | $ 45.290 | +
const CreditCardTransactionSchema = z.array(
  z.object({
    date: z.string().describe("Transaction date in DD/MM/YYYY format, e.g. '15/03/2026'"),
    description: z.string().describe("Merchant/description from the Descripción column, e.g. 'SUPERMERCADO JUMBO SANTIAGO CL'"),
    amount: z.number().describe("Cargo amount as a positive number in CLP without dots or $, e.g. 45290"),
    installments: z
      .string()
      .optional()
      .describe("Cuotas value from the Cuotas column, e.g. '01/01' or '01/03'"),
    city: z.string().optional().describe("City from the Ciudad column if present, e.g. 'SANTIAGO'"),
  }),
);

// Schema for extracting dashboard account info
// Example: Cuenta Corriente 00-319-08421-05 Disponible $1.250.430
//          VISA •••• 7832 TITULAR VISA PLATINUM
const DashboardInfoSchema = z.object({
  checkingAccountBalance: z
    .number()
    .optional()
    .describe("Cuenta Corriente available balance in CLP, e.g. 1250430"),
  creditCardLast4: z
    .string()
    .optional()
    .describe("Last 4 digits of the credit card, e.g. '7832'"),
});

export class BancoChileScraper extends BaseScraper {
  readonly bankId: BankId = "banco-chile";
  readonly bankUrl = "https://sitiospublicos.bancochile.cl/personas";

  // BancoChile portal URL (hash routing — Angular SPA)
  private readonly creditCardUrl = "https://portalpersonas.bancochile.cl/mibancochile-web/front/personaBEC/index.html#/tarjeta-credito/consultar/saldos";

  protected async execute(
    credentials: BankCredentials,
    _dateRange?: { from: Date; to: Date },
  ): Promise<TransactionData[]> {
    const stagehand = await this.createStagehand();

    try {
      const page = stagehand.context.pages()[0];

      // Step 1: Go directly to the login page (skips landing page, avoids cross-domain navigation issues)
      await page.goto("https://login.portales.bancochile.cl/login", { waitUntil: "networkidle" });
      // Wait for Angular login form to render (headless may be slower)
      await page.waitForTimeout(5000);

      // Step 2: Login — use act() for reliability (the login form uses dynamic Angular rendering)
      await stagehand.act(
        "type %username% into the RUT input field",
        { variables: { username: credentials.username } },
      );
      await stagehand.act(
        "type %password% into the Contraseña input field",
        { variables: { password: credentials.password } },
      );
      await stagehand.act(
        "click the 'INGRESAR' button",
      );

      // Step 3: Wait for dashboard to load (Angular SPA, never reaches networkidle)
      await page.waitForTimeout(5000);

      // Step 4: Dismiss Angular Material CDK overlay popups (promotional modals)
      await this.dismissPopups(stagehand);

      // Step 5: Handle potential 2FA
      await this.handle2FA(stagehand, credentials);

      // Step 6: Extract dashboard info (checking balance + card last 4 digits)
      const dashboardInfo = await stagehand.extract(
        "extract the 'Cuenta Corriente' available balance (the number next to 'Disponible' under 'Cuenta Corriente', e.g. 1250430) and the last 4 digits of any credit card shown (e.g. '7832' from 'VISA •••• 7832')",
        DashboardInfoSchema,
      ).catch(() => ({ checkingAccountBalance: undefined, creditCardLast4: undefined }));

      const cardLast4 = dashboardInfo.creditCardLast4 ?? "0000";

      // Step 7: Navigate directly to credit card transactions via URL
      // Much more reliable than clicking through Angular Material menus
      await page.goto(this.creditCardUrl, { waitUntil: "domcontentloaded" });

      // Wait for the transactions table to render (Angular async component)
      await page.waitForSelector("table", { state: "visible", timeout: 15000 }).catch(() => {
        // Table might not exist if there are no transactions
      });
      await page.waitForTimeout(2000);
      await this.dismissPopups(stagehand);

      // Step 8: Extract transactions using AI (this is where Stagehand excels)
      const rawTransactions = await stagehand.extract(
        "extract all rows from the credit card transactions table. The table has columns: Fecha (date DD/MM/YYYY like '15/03/2026'), Tipo de Tarjeta, Descripción (merchant name like 'SUPERMERCADO JUMBO SANTIAGO CL'), Ciudad (city like 'SANTIAGO'), Cuotas (like '01/01' or '01/03'), Cargo (amount in CLP as number like 45290). Extract every row visible.",
        CreditCardTransactionSchema,
      );

      // Best-effort logout
      await page.locator('a:has-text("CERRAR SESIÓN")').click().catch(() => {});

      return rawTransactions.map((tx) => ({
        amount: tx.amount,
        currency: "CLP" as const,
        merchant: tx.description,
        bank: this.bankId,
        cardLast4,
        date: this.parseDate(tx.date),
        installments: this.parseInstallments(tx.installments),
        description: tx.city ? `${tx.description} - ${tx.city}` : tx.description,
      }));
    } finally {
      await stagehand.close();
    }
  }

  private async dismissPopups(stagehand: import("@browserbasehq/stagehand").Stagehand): Promise<void> {
    const page = stagehand.context.pages()[0];
    // BancoChile uses Angular Material CDK overlays for promotional modals
    // Target the overlay container directly with locators — no AI needed
    try {
      // Try clicking the X/close button inside any CDK overlay
      const closeBtn = page.locator(
        '.cdk-overlay-container button.close, .cdk-overlay-container .close-btn, .cdk-overlay-container [aria-label="Close"], .cdk-overlay-container mat-icon:has-text("close")',
      );
      if (await closeBtn.count() > 0) {
        await closeBtn.first().click();
        await page.waitForTimeout(500);
        return;
      }

      // Try the "No ver Más" dismiss link
      const noVerMas = page.locator('a:has-text("No ver Más"), a:has-text("No ver más")');
      if (await noVerMas.count() > 0) {
        await noVerMas.first().click();
        await page.waitForTimeout(500);
      }
    } catch {
      // No popup — that's fine
    }
  }

  private async handle2FA(
    stagehand: import("@browserbasehq/stagehand").Stagehand,
    credentials: BankCredentials,
  ): Promise<void> {
    const pageState = await stagehand
      .extract(
        "is there a security question, OTP code input, or 2FA challenge visible? Answer has2FA true only if you see an actual challenge form.",
        z.object({
          has2FA: z.boolean().describe("true only if a 2FA challenge form is visible"),
          challengeType: z
            .enum(["security_question", "sms_otp", "totp", "none"])
            .describe("Type of challenge if present"),
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
        await stagehand.act("click the submit button");
      }
    }

    if (pageState.challengeType === "sms_otp" && this.options.onOtpRequired) {
      const otpCode = await this.options.onOtpRequired();
      await stagehand.act("type %otp% into the OTP code input field", {
        variables: { otp: otpCode },
      });
      await stagehand.act("click the verify button");
    }
  }

  private parseDate(dateStr: string): Date {
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

  private parseInstallments(cuotas?: string): number | undefined {
    if (!cuotas) return undefined;
    // Format: "01/06" means installment 1 of 6
    const parts = cuotas.match(/(\d+)\/(\d+)/);
    if (parts) {
      return parseInt(parts[2], 10);
    }
    return undefined;
  }
}

registerScraper("banco-chile", BancoChileScraper);
