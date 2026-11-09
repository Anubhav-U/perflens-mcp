// End-to-end smoke test over stdio, the way Claude Code and Cursor launch the server.
// Usage: npm run build && node scripts/smoke-stdio.mjs [url]
// Any non-protocol output on stdout would break the JSON-RPC stream and fail this script.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const url = process.argv[2] ?? "https://developer.mozilla.org/en-US/";

const transport = new StdioClientTransport({ command: process.execPath, args: ["dist/index.js"], stderr: "pipe" });
const stderr = [];
transport.stderr?.on("data", (chunk) => stderr.push(String(chunk)));

const client = new Client({ name: "smoke", version: "0.0.0" });
const t0 = Date.now();
await client.connect(transport);
console.log(`connected in ${Date.now() - t0} ms`);

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));

async function call(name, args) {
  const started = Date.now();
  const result = await client.callTool({ name, arguments: args }, undefined, {
    timeout: 300_000,
    onprogress: (p) => console.log(`  progress: ${p.message}`),
  });
  const text = result.content?.[0]?.text ?? "";
  console.log(`\n=== ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)${result.isError ? " ERROR" : ""}`);
  console.log(text.split("\n").slice(0, 14).join("\n"));
  return result;
}

await call("explain_metric", { name: "inp" });
const audit = await call("audit_url", { url, device: "mobile" });
const { auditDurationMs: _ignored, ...summary } = audit.structuredContent ?? {};
await call("suggest_fixes", { audit: summary, limit: 3 });
await call("compare_urls", { urlA: url });
await call("audit_url", { url: "https://does-not-exist.invalid" });

await client.close();
console.log("\nserver stderr:\n" + stderr.join("").trim());
