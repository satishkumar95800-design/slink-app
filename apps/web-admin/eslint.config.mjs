import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // docs/SPEC-languages.md: console text must come from messages/*.json via t().
  // Flags literal words in JSX (e.g. <button>Save</button>, label="Save").
  {
    files: [
      "app/admin/**/*.tsx",
      "app/login/**/*.tsx",
      "components/layout/**/*.tsx",
      "components/import/**/*.tsx",
      "components/ui/**/*.tsx",
    ],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: false,
          ignoreProps: false,
          noAttributeStrings: false,
          allowedStrings: ["—", "·", "→", "←", "×", "✕", "*", "%", "–", "/", ":", "(", ")", "₹", "🌐", "📭", "#", "S"],
        },
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
