import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "out/**", "docs/try/**", "next-env.d.ts"] },
  // The two React Compiler advisory rules flag the loading/streaming hooks' intentional setState-in-effect
  // and ref reads. This app doesn't use the React Compiler, so they stay off; every other rule applies.
  { rules: { "react-hooks/set-state-in-effect": "off", "react-hooks/refs": "off" } },
];
export default config;
