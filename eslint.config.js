import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // site/ is a separate Next.js app with its own lint setup.
  { ignores: ["dist", "node_modules", "coverage", "site"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      // stdout carries the MCP protocol over stdio; log to stderr via console.error.
      "no-console": ["error", { allow: ["error"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Dev scripts are not the server and may print to stdout.
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
);
