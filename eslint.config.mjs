import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";

export default tseslint.config(
  { ignores: ["node_modules/**", ".next/**", "coverage/**"] },
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
