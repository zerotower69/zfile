import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json"
import polyfillNode from "rollup-plugin-polyfill-node";
import alias from "@rollup/plugin-alias"
import { defineConfig } from "rollup";
import path from "node:path"

export default defineConfig({
    input: "./src/index.ts",
    cache: false,
    output: [
        {
            file: "./dist/index.mjs",
            format: "es",
        }
    ],
    plugins: [
      // alias({
      //   entries:[
      //     {
      //       find:"@/",replacement:path.resolve(process.cwd(),'src')
      //     }
      //   ]
      // }),
        polyfillNode(),
        json(),
        nodeResolve({
          preferBuiltins:false,
          browser:true
        }),
        typescript({
            tsconfig: "tsconfig.json",
            outputToFilesystem: false,
        }),
        commonjs(),
        terser({
          compress:true
        }),
    ],
});
