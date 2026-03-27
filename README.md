# scrapers-bancos-chile

AI-powered scrapers for Chilean banks using [Stagehand](https://github.com/browserbase/stagehand) (Playwright + LLM).

Supports:
- Banco de Chile / Edwards
- Santander Chile
- Banco Falabella

## Install

```sh
npm install scrapers-bancos-chile
```

Peer dependencies:

```sh
npm install @browserbasehq/stagehand @anthropic-ai/sdk
```

## Usage

```ts
import { createScraper } from "scrapers-bancos-chile";

const scraper = createScraper("banco-chile", {
  llmApiKey: process.env.LLM_API_KEY!,
  llmProvider: "anthropic",
  headless: true,
});

const result = await scraper.scrape({
  username: "your-rut",
  password: "your-password",
});

if (result.success) {
  console.log(`Found ${result.transactions.length} transactions`);
  for (const tx of result.transactions) {
    console.log(`${tx.date} | ${tx.merchant} | $${tx.amount} ${tx.currency}`);
  }
}
```

## BYOK (Bring Your Own Key)

This library requires you to provide your own LLM API key. Stagehand uses it for AI-powered navigation and data extraction. Your bank credentials are **never** sent to the LLM — they are injected directly via Playwright's `page.fill()`.

## Adding a New Bank

1. Create a new file in `src/` extending `BaseScraper`
2. Implement the `execute()` method with the bank's login and transaction extraction flow
3. Call `registerScraper()` to register it with the factory
4. Import the file in `src/index.ts`

## License

MIT
