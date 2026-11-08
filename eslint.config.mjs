import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // Preserve the existing non-Compiler lint baseline during the renderer upgrade.
    // React Compiler is not enabled; rules-of-hooks and exhaustive-deps stay on.
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  globalIgnores([".next/**", ".next-*/**", "out/**", "build/**", "next-env.d.ts"]),
]);
