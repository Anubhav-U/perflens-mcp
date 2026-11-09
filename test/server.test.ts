import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lhr } from "../src/core/lhr.js";
import type { AuditRunner } from "../src/runner/audit.js";
import { createServer } from "../src/server.js";
import { loadFixture, type FixtureName } from "./helpers.js";

/** A fake runner that serves fixtures by URL, so the full MCP path runs without Chrome. */
function fakeRunner(byUrl: Record<string, FixtureName | Error>) {
  const audit = vi.fn(async (url: string) => {
    const entry = byUrl[url];
    if (!entry) throw new Error(`unexpected url ${url}`);
    if (entry instanceof Error) throw entry;
    return { lhr: loadFixture(entry) as Lhr, durationMs: 12_345, browser: { path: "/chrome", source: "chrome" as const } };
  });
  return { audit } as unknown as AuditRunner & { audit: typeof audit };
}

let client: Client | undefined;

async function connect(runner: AuditRunner) {
  const server = createServer({ runner });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

afterEach(async () => {
  await client?.close();
  client = undefined;
});

type Result = { content: { type: string; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
const call = async (c: Client, name: string, args: Record<string, unknown>) =>
  (await c.callTool({ name, arguments: args })) as Result;

describe("MCP server", () => {
  it("lists the four tools with input and output schemas", async () => {
    const c = await connect(fakeRunner({}));
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["audit_url", "compare_urls", "explain_metric", "suggest_fixes"]);
    for (const t of tools) {
      expect(t.description!.length).toBeGreaterThan(50);
      expect(t.outputSchema).toBeDefined();
      expect(t.annotations?.readOnlyHint).toBe(true);
    }
    const audit = tools.find((t) => t.name === "audit_url")!;
    expect(audit.inputSchema.required).toEqual(["url"]);
  });

  it("audit_url returns text and validated structured content", async () => {
    const runner = fakeRunner({ "https://example.com/": "example-mobile" });
    const c = await connect(runner);
    const r = await call(c, "audit_url", { url: "example.com" });
    expect(r.isError).toBeFalsy();
    expect(r.content[0]!.text).toMatch(/^## Lighthouse performance: 100\/100 \(mobile\)/);
    expect(r.content[0]!.text).toMatch(/Audit took 12\.3 s\./);
    expect(r.structuredContent).toMatchObject({ performanceScore: 100, device: "mobile", auditDurationMs: 12_345 });
    expect(runner.audit).toHaveBeenCalledWith("https://example.com/", { device: "mobile", timeoutMs: undefined });
  });

  it("audit_url turns bad input into a readable tool error, not a crash", async () => {
    const c = await connect(fakeRunner({}));
    const r = await call(c, "audit_url", { url: "file:///etc/hosts" });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/Only http and https/);
  });

  it("audit_url reports runner failures as tool errors", async () => {
    const c = await connect(fakeRunner({ "https://down.test/": new Error("socket hang up") }));
    const r = await call(c, "audit_url", { url: "https://down.test" });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toBe("Unexpected error: socket hang up");
  });

  it("rejects schema-invalid arguments", async () => {
    const c = await connect(fakeRunner({}));
    const r = await call(c, "audit_url", { url: "https://example.com", device: "tablet" });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/Input validation error/);
  });

  it("compare_urls compares two URLs", async () => {
    const c = await connect(fakeRunner({ "https://a.test/": "news-mobile", "https://b.test/": "mdn-mobile" }));
    const r = await call(c, "compare_urls", { urlA: "https://a.test", urlB: "https://b.test" });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ mode: "two-urls", score: { a: 16, b: 93, delta: 77, change: "better" } });
  });

  it("compare_urls does before/after against the session's previous audit", async () => {
    const byUrl: Record<string, FixtureName> = { "https://site.test/": "news-mobile" };
    const c = await connect(fakeRunner(byUrl));

    const missing = await call(c, "compare_urls", { urlA: "https://site.test" });
    expect(missing.isError).toBe(true);
    expect(missing.content[0]!.text).toMatch(/Run audit_url first/);

    await call(c, "audit_url", { url: "https://site.test" });
    byUrl["https://site.test/"] = "mdn-mobile"; // the "after" run
    const r = await call(c, "compare_urls", { urlA: "https://site.test" });
    expect(r.structuredContent).toMatchObject({ mode: "before-after", score: { a: 16, b: 93 } });
  });

  it("compare_urls accepts an audit_url result unchanged as baseline", async () => {
    const c = await connect(fakeRunner({ "https://site.test/": "mdn-mobile" }));
    const before = await call(c, "audit_url", { url: "https://site.test" });
    const r = await call(c, "compare_urls", { urlA: "https://site.test", baseline: before.structuredContent });
    expect(r.structuredContent).toMatchObject({ mode: "before-after", score: { change: "unchanged" } });
  });

  it("explains an invalid baseline instead of failing silently", async () => {
    const c = await connect(fakeRunner({ "https://site.test/": "mdn-mobile" }));
    const r = await call(c, "compare_urls", { urlA: "https://site.test", baseline: { url: "x", performanceScore: "high" } });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/^baseline is not a valid audit_url result at /);
  });

  it("keeps the published tool list compact", async () => {
    const c = await connect(fakeRunner({}));
    const { tools } = await c.listTools();
    for (const t of tools) expect(JSON.stringify(t.inputSchema).length, t.name).toBeLessThan(1500);
  });

  it("explain_metric explains known metrics and lists options for unknown ones", async () => {
    const c = await connect(fakeRunner({}));
    const r = await call(c, "explain_metric", { name: "cls" });
    expect(r.structuredContent).toMatchObject({ id: "CLS", coreWebVital: true, thresholds: { mobile: { good: 0.1 } } });
    expect(r.structuredContent).not.toHaveProperty("auditId");
    const bad = await call(c, "explain_metric", { name: "ttfb" });
    expect(bad.isError).toBe(true);
    expect(bad.content[0]!.text).toMatch(/Known metrics: LCP, FCP, CLS, TBT, SI, INP/);
  });

  it("suggest_fixes reuses a previous audit without re-running Lighthouse", async () => {
    const runner = fakeRunner({ "https://news.test/": "news-mobile" });
    const c = await connect(runner);
    const audit = await call(c, "audit_url", { url: "https://news.test", maxOpportunities: 20 });
    const r = await call(c, "suggest_fixes", { audit: audit.structuredContent, limit: 3 });
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent!.fixes as unknown[]).length).toBe(3);
    expect(runner.audit).toHaveBeenCalledTimes(1);
  });

  it("suggest_fixes can audit a URL itself", async () => {
    const c = await connect(fakeRunner({ "https://news.test/": "news-mobile" }));
    const r = await call(c, "suggest_fixes", { url: "news.test" });
    expect(r.content[0]!.text).toMatch(/### 1\. Load the LCP element sooner/);
  });

  it("suggest_fixes requires exactly one of url or audit", async () => {
    const c = await connect(fakeRunner({}));
    const r = await call(c, "suggest_fixes", {});
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/Pass either url .* or audit/);
  });

  it("runs Lighthouse several times and keeps the median run when runs > 1", async () => {
    const sequence: FixtureName[] = ["news-mobile", "mdn-mobile", "example-mobile"]; // scores 16, 93, 100
    let i = 0;
    const audit = vi.fn(async () => ({
      lhr: loadFixture(sequence[i++]!) as Lhr,
      durationMs: 10_000,
      browser: { path: "/chrome", source: "chrome" as const },
    }));
    const c = await connect({ audit } as unknown as AuditRunner);
    const messages: string[] = [];
    const r = (await c.callTool({ name: "audit_url", arguments: { url: "https://site.test", runs: 3 } }, undefined, {
      onprogress: (p) => messages.push(p.message ?? ""),
    })) as Result;
    expect(audit).toHaveBeenCalledTimes(3);
    expect(r.structuredContent).toMatchObject({ performanceScore: 93, auditDurationMs: 30_000 });
    expect((r.structuredContent!.warnings as string[])[0]).toBe("Median of 3 runs (scores: 16, 93, 100).");
    expect(messages.at(-1)).toMatch(/\(run 3\/3\)$/);
  });

  it("sends progress notifications when the client asks for them", async () => {
    const c = await connect(fakeRunner({ "https://example.com/": "example-mobile" }));
    const messages: string[] = [];
    await c.callTool({ name: "audit_url", arguments: { url: "https://example.com" } }, undefined, {
      onprogress: (p) => messages.push(p.message ?? ""),
    });
    expect(messages).toEqual(["Running Lighthouse (mobile) on https://example.com/"]);
  });
});
