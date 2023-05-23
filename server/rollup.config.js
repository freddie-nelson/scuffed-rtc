import eslint from "@rollup/plugin-eslint";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import del from "rollup-plugin-delete";
import { typescriptPaths } from "rollup-plugin-typescript-paths";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

/** @type {import('rollup').RollupOptions} */
const options = {
    input: "src/index.ts",
    output: [
        {
            file: "dist/index.js",
            format: "esm",
            sourcemap: true,
        },
        {
            file: "dist/index.cjs",
            format: "cjs",
            sourcemap: true,
        },
        {
            file: "dist/index.min.js",
            format: "iife",
            name: "ScuffedRTCServer",
            plugins: [terser()],
            sourcemap: true,
        },
    ],
    plugins: [
        del({ targets: "dist/*" }),
        typescript(),
        typescriptPaths(),
        json(),
        eslint({
            fix: true,
        }),
        resolve({
            node: true,
        }),
        commonjs({
            include: "node_modules/**",
        }),
    ],
};

export default options;
