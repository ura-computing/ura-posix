import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // `const { a: _a, ...rest } = x` drops `a` on purpose.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    // A context provider and its hook stay in one file (useT, useUpload, useGlobalDateRange); main.tsx = the app root.
    files: [
      "src/i18n/I18nProvider.tsx",
      "src/hooks/UploadContext.tsx",
      "src/hooks/useGlobalDateRange.tsx",
      "src/main.tsx",
    ],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Pages use the atoms (Button, Input, Select, Textarea): one look everywhere. Only a file input stays raw.
    files: ["src/pages/**/*.tsx"],
    ignores: ["src/pages/store/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "JSXOpeningElement[name.name='button']", message: "Use Button (atoms/Button.tsx) or a molecule." },
        {
          selector: "JSXOpeningElement[name.name=/^(select|textarea)$/]",
          message: "Use Select / Textarea (atoms/Input.tsx).",
        },
        {
          selector:
            "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value='file']))",
          message: "Use Input / SearchInput (atoms/Input.tsx); only a file input stays raw.",
        },
      ],
    },
  },
]);
