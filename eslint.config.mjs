import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Prisma relation results and request bodies are loosely typed; `any` is used
      // judiciously in route handlers and validated elsewhere (Zod + tsc strict).
      "@typescript-eslint/no-explicit-any": "warn",
      // react-hooks purity rules flag Date.now() / setState-in-effect which are
      // acceptable in this interactive scoring UI; keep as warnings.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Build tooling config files run through Node directly and stay CommonJS.
    files: ["tailwind.config.js", "postcss.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
