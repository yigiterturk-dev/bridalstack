import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // E2e aşamalarında `check(..., koşul && yanKoşul)` kalıbı bilinçlidir:
  // kısa dev, ikinci koşulun değerlendirildiği anlamına gelmez; bu dosyalarda
  // kural gürültü üretir.
  {
    files: ["tests/e2e/**/*.mjs"],
    rules: { "@typescript-eslint/no-unused-expressions": "off" },
  },
  // `_önek` bilinçli bir yoksayma işaretidir (ör. destructure ile alan silme).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
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
