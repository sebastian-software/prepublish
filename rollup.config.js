import babel from "rollup-plugin-babel"
import builtinModules from "builtin-modules"
import executable from "rollup-plugin-executable"
import json from "rollup-plugin-json"

process.env.NODE_ENV = "production"

/* eslint-disable-next-line import/no-commonjs */
const pkg = require("./package.json")
const external = Object.keys(pkg.dependencies).concat(builtinModules)

export default {
  input: "src/index.js",
  output: {
    file: "bin/prepublish",
    format: "cjs",
    sourcemap: true,
    banner: "#!/usr/bin/env node\n"
  },
  external,
  plugins: [
    json(),
    babel({
      runtimeHelpers: true
    }),
    executable()
  ]
}
