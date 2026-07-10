// ESLint flat config.
//
// The site ships these .js files straight to the browser — there's no build
// step to parse them ahead of time, so a file only fails when its code path
// runs. ESLint parses every file on every run, catching that whole class
// statically.

import js from "@eslint/js";
import globals from "globals";

const rules = {
  // `_`-prefixed args are intentional-unused (positional callback params).
  "no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", caughtErrors: "none" },
  ],
};

export default [
  { ignores: ["node_modules/**"] },

  js.configs.recommended,

  // Site source
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    rules,
  },

  // Tests + tooling
  {
    files: ["tests/**/*.js", "*.config.js", "*.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules,
  },
];
