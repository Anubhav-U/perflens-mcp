import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../src/runner/url.js";

describe("normalizeUrl", () => {
  it.each([
    ["https://example.com", "https://example.com/"],
    ["  https://example.com/path?q=1  ", "https://example.com/path?q=1"],
    ["example.com", "https://example.com/"],
    ["www.example.com/blog", "https://www.example.com/blog"],
    ["localhost:3000", "http://localhost:3000/"],
    ["127.0.0.1:8080/app", "http://127.0.0.1:8080/app"],
    ["http://localhost:5173", "http://localhost:5173/"],
    ["http://192.168.1.20:3000", "http://192.168.1.20:3000/"],
    ["HTTPS://EXAMPLE.COM", "https://example.com/"],
  ])("accepts %j", (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it.each([
    ["", /No URL was given/],
    ["   ", /No URL was given/],
    ["file:///etc/passwd", /Only http and https/],
    ["javascript:alert(1)", /Only http and https/],
    ["chrome://settings", /Only http and https/],
    ["ftp://example.com", /Only http and https/],
    ["https://user:secret@example.com", /Remove the username and password/],
    ["https://", /not a valid URL/],
    ["http://exa mple.com", /not a valid URL/],
  ])("rejects %j", (input, message) => {
    expect(() => normalizeUrl(input)).toThrow(message);
  });

  it("rejects overly long URLs", () => {
    expect(() => normalizeUrl(`https://example.com/${"a".repeat(2100)}`)).toThrow(/longer than 2048/);
  });

  it("uses the INVALID_URL code", () => {
    try {
      normalizeUrl("file:///x");
      expect.unreachable();
    } catch (err) {
      expect((err as { code: string }).code).toBe("INVALID_URL");
    }
  });
});
