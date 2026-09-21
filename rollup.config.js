import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

export default [
  // JavaScript bundle
  {
    input: "index.ts",
    output: [
      { file: "dist/index.js", format: "cjs" },
      { file: "dist/index.esm.js", format: "es" },
    ],
    plugins: [typescript()],
  },
  // TypeScript declaration bundle
  {
    input: "index.ts",
    output: { file: "dist/index.d.ts", format: "es" },
    plugins: [dts()],
  },
];
