import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";

export default tseslint.config(
  // `.claude/**` and `.agents/**` hold tool and plugin assets (skills, agent
  // definitions, plan files) and `reports/**` holds gitignored local
  // artefacts. Prettier already skips all three — it honours .prettierignore
  // and .gitignore — but ESLint does not honour .gitignore, so it must be
  // told explicitly or third-party skill scripts and scratch prototypes break
  // the lint gate.
  //
  // `.next-prefixed/**` is the prefixed build's output directory, the
  // counterpart of `.next/**`. It holds generated code and must be skipped
  // for the same reason.
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-prefixed/**",
      "coverage/**",
      ".claude/**",
      ".agents/**",
      "reports/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "import-x": importX },
    languageOptions: {
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    settings: {
      "import-x/resolver": {
        typescript: { alwaysTryTypes: true, project: "./tsconfig.json" },
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Order: builtin (node), external, internal (@/ alias), parent, sibling, index.
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          pathGroups: [{ pattern: "@/**", group: "internal", position: "after" }],
          "newlines-between": "never",
        },
      ],
    },
  },
  prettierConfig,
);
