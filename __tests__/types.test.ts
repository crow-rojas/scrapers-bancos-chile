import { describe, it, expect } from "vitest";
import { TransactionDataSchema } from "../src/types.js";

describe("TransactionDataSchema", () => {
  it("should validate a valid CLP transaction", () => {
    const result = TransactionDataSchema.safeParse({
      amount: 15000,
      merchant: "Supermercado Lider",
      bank: "banco-chile",
      cardLast4: "1234",
      date: "2026-03-27",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("CLP");
      expect(result.data.amount).toBe(15000);
    }
  });

  it("should validate a USD transaction", () => {
    const result = TransactionDataSchema.safeParse({
      amount: 49.99,
      currency: "USD",
      merchant: "Amazon.com",
      bank: "santander",
      cardLast4: "5678",
      date: "2026-03-25",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid bank ID", () => {
    const result = TransactionDataSchema.safeParse({
      amount: 1000,
      merchant: "Test",
      bank: "invalid-bank",
      cardLast4: "1234",
      date: "2026-03-27",
    });
    expect(result.success).toBe(false);
  });

  it("should coerce date strings to Date objects", () => {
    const result = TransactionDataSchema.safeParse({
      amount: 5000,
      merchant: "Starbucks",
      bank: "falabella",
      cardLast4: "9999",
      date: "2026-03-15T10:30:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBeInstanceOf(Date);
    }
  });

  it("should accept optional installments", () => {
    const result = TransactionDataSchema.safeParse({
      amount: 300000,
      merchant: "Falabella",
      bank: "falabella",
      cardLast4: "4321",
      date: "2026-03-20",
      installments: 6,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.installments).toBe(6);
    }
  });
});
