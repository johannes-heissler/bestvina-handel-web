// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", ".claude/"] },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["src/**/*.ts"],
    rules: {
      // Layering (see docs/architecture.md): the mathematical core must not depend on rendering or UI.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["three", "three/*", "**/render/**", "**/ui/**"],
              message: "Only src/render and src/ui may import three.js or rendering/UI code.",
            },
          ],
        },
      ],
    },
  },
  {
    // Tests may assert that an element exists.
    files: ["src/**/*.test.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    files: ["src/render/**/*.ts", "src/ui/**/*.ts", "src/main.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Research scripts run with Node; like tests, they may assert that a value exists.
    files: ["scripts/**"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        performance: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      // Destructuring to leave out fields: const { a, b, ...rest } = r.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
);
