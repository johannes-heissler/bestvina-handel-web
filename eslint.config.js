// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },
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
    files: ["src/render/**/*.ts", "src/ui/**/*.ts", "src/main.ts"],
    rules: { "no-restricted-imports": "off" },
  },
);
