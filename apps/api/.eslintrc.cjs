/* eslint-disable @typescript-eslint/no-require-imports -- ESLint config */
const path = require("path");
const rulesDirPlugin = require("eslint-plugin-rulesdir");
rulesDirPlugin.RULES_DIR = path.join(__dirname, "eslint-rules");

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2022,
  },
  plugins: ["rulesdir"],
  ignorePatterns: ["dist/", "node_modules/"],
  rules: {
    "rulesdir/no-raw-tenant-mutation": "error",
  },
};
