import { resolve, relative, isAbsolute, dirname } from "path"
import { eachOfSeries } from "async"
import { camelCase } from "lodash"
import fileExists from "file-exists"
import meow from "meow"
import chalk from "chalk"
import { get as getRoot } from "app-root-dir"

import { rollup } from "rollup"
import rebase from "rollup-plugin-rebase"
import nodeResolve from "rollup-plugin-node-resolve"
import cjsPlugin from "rollup-plugin-commonjs"
import jsonPlugin from "rollup-plugin-json"
import yamlPlugin from "rollup-plugin-yaml"
import replacePlugin from "rollup-plugin-replace"
import executablePlugin from "rollup-plugin-executable"

import createBabelConfig from "./createBabelConfig"
import getBanner from "./getBanner"

const ROOT = getRoot()
const PKG_CONFIG = require(resolve(ROOT, "package.json"))

let cache

/* eslint-disable no-console */

const command = meow(
  `
  Usage
    $ prepublish

  Options
    --input-node       Input file for NodeJS target [default = auto]
    --input-web        Input file for Browser target [default = auto]
    --input-binary     Input file for Binary target [default = auto]

    --output-folder    Configure the output folder [default = auto]

    -x, --minified     Enabled minification of output files
    -m, --sourcemap    Create a source map file during processing

    --target-modern    Binaries should target Node v8 LTS instead of Node v6 LTS.

    -v, --verbose      Verbose output mode [default = false]
    -q, --quiet        Quiet output mode [default = false]
`,
  {
    flags: {
      inputNode: {
        default: null
      },

      inputWeb: {
        default: null
      },

      inputBinary: {
        default: null
      },

      outputFolder: {
        default: null
      },

      minified: {
        default: false,
        alias: "x"
      },

      sourcemap: {
        default: true,
        alias: "m"
      },

      targetModern: {
        default: false
      },

      verbose: {
        default: false,
        alias: "v"
      },

      quiet: {
        default: false,
        alias: "q"
      }
    }
  }
)

const verbose = command.flags.verbose
const quiet = command.flags.quiet
const targetModern = command.flags.targetModern

if (verbose) {
  console.log("Flags:", command.flags)
}

// Handle special case to generate a binary file based on config in package.json
const binaryConfig = PKG_CONFIG.bin
let binaryOutput = null
if (binaryConfig) {
  for (const name in binaryConfig) {
    binaryOutput = binaryConfig[name]
    break
  }
}

/* eslint-disable dot-notation */
const outputFileMatrix = {
  // NodeJS es5 Target
  "node-es5-cjs": PKG_CONFIG["main"] || null,
  "node-es5-esm": PKG_CONFIG["module"] || PKG_CONFIG["jsnext:main"] || null,

  // NodeJS ES2015 Target
  "node-es2015-cjs": PKG_CONFIG["main:es2015"] || null,
  "node-es2015-esm": PKG_CONFIG["es2015"] || PKG_CONFIG["module:es2015"] || null,

  // NodeJS Modern Target
  "node-modern-cjs": PKG_CONFIG["main:modern"] || null,
  "node-modern-esm": PKG_CONFIG["module:modern"] || null,

  // Browser es5 Target
  "web-es5-esm": PKG_CONFIG["web"] || PKG_CONFIG["browser"] || null,

  // Browser ES2015 Target
  "web-es2015-esm": PKG_CONFIG["web:es2015"] || PKG_CONFIG["browser:es2015"] || null,

  // Browser Modern Target
  "web-modern-esm": PKG_CONFIG["web:modern"] || PKG_CONFIG["browser:modern"] || null,

  // Binary Target
  "binary-binary-cjs": binaryOutput || null
}

const outputFolder = command.flags.outputFolder
if (outputFolder) {
  outputFileMatrix["node-es5-cjs"] = `${outputFolder}/node.es5.cjs.js`
  outputFileMatrix["node-es5-esm"] = `${outputFolder}/node.es5.esm.js`

  outputFileMatrix["node-es2015-cjs"] = `${outputFolder}/node.es2015.cjs.js`
  outputFileMatrix["node-es2015-esm"] = `${outputFolder}/node.es2015.esm.js`

  outputFileMatrix["node-modern-cjs"] = `${outputFolder}/node.modern.cjs.js`
  outputFileMatrix["node-modern-esm"] = `${outputFolder}/node.modern.esm.js`

  outputFileMatrix["web-es5-esm"] = `${outputFolder}/web.es5.esm.js`
  outputFileMatrix["web-es2015-esm"] = `${outputFolder}/web.es2015.esm.js`
  outputFileMatrix["web-modern-esm"] = `${outputFolder}/web.modern.esm.js`
}

const name = PKG_CONFIG.name || camelCase(PKG_CONFIG.name)
const banner = getBanner(PKG_CONFIG)
const targets = {}
const formats = [ "esm", "cjs" ]

if (command.flags.inputNode) {
  targets.node = [ command.flags.inputNode ]
} else {
  targets.node = [
    "src/node/public.js",
    "src/node/export.js",
    "src/node.js",

    "src/server/public.js",
    "src/server/export.js",
    "src/server.js",

    "src/server.js",
    "src/public.js",
    "src/export.js",
    "src/index.js"
  ]
}

if (command.flags.inputWeb) {
  targets.web = [ command.flags.inputWeb ]
} else {
  targets.web = [
    "src/web/public.js",
    "src/web/export.js",
    "src/web.js",

    "src/browser/public.js",
    "src/browser/export.js",
    "src/browser.js",

    "src/client/public.js",
    "src/client/export.js",
    "src/client.js"
  ]
}

if (command.flags.inputBinary) {
  targets.binary = [ command.flags.inputBinary ]
} else {
  targets.binary = [ "src/cli.js", "src/binary.js", "src/script.js" ]
}

/* eslint-disable max-params */
try {
  eachOfSeries(targets, (envInputs, targetId, envCallback) => {
    const input = lookupBest(envInputs)
    if (input) {
      if (!quiet) {
        console.log(`Using input ${chalk.blue(input)} for target ${chalk.blue(targetId)}`)
      }

      eachOfSeries(
        formats,
        (format, formatIndex, formatCallback) => {
          const configs = createBabelConfig({
            minified: command.flags.minified,
            presets: [],
            plugins: [],
            targetModern
          })

          eachOfSeries(
            configs,
            (currentTranspiler, transpilerId, variantCallback) => {
              const outputFile = outputFileMatrix[`${targetId}-${transpilerId}-${format}`]
              if (outputFile) {
                return bundleTo({
                  input,
                  targetId,
                  transpilerId,
                  currentTranspiler,
                  format,
                  outputFile,
                  variantCallback
                })
              } else {
                return variantCallback(null)
              }
            },
            formatCallback
          )
        },
        envCallback
      )
    } else {
      envCallback(null)
    }
  })
} catch (error) {
  /* eslint-disable no-process-exit */
  console.error(error)
  process.exit(1)
}

function lookupBest(candidates) {
  const filtered = candidates.filter(fileExists.sync)
  return filtered[0]
}

function bundleTo({
  input,
  targetId,
  transpilerId,
  currentTranspiler,
  format,
  outputFile,
  variantCallback
}) {
  if (!quiet) {
    /* eslint-disable max-len */
    console.log(
      `${chalk.green(">>> Bundling")} ${chalk.magenta(PKG_CONFIG.name)}-${chalk.magenta(
        PKG_CONFIG.version
      )} as ${chalk.blue(transpilerId)} defined as ${chalk.blue(format)} to ${chalk.green(
        outputFile
      )}...`
    )
  }

  const prefix = "process.env."
  const variables = {
    [`${prefix}NAME`]: JSON.stringify(PKG_CONFIG.name),
    [`${prefix}VERSION`]: JSON.stringify(PKG_CONFIG.version),
    [`${prefix}TARGET`]: JSON.stringify(targetId)
  }

  const rebasePlugin = rebase({ verbose })
  return rollup({
    input,
    cache,
    onwarn: (error) => {
      console.warn(chalk.red(`  - ${error.message}`))
    },
    external(dependency) {
      if (dependency === input) {
        return false
      }

      if (isAbsolute(dependency)) {
        const relativePath = relative(ROOT, dependency)
        return Boolean((/node_modules/).exec(relativePath))
      }

      return dependency.charAt(0) !== "."
    },
    plugins: [
      rebasePlugin,
      nodeResolve({
        extensions: [ ".mjs", ".js", ".jsx", ".ts", ".tsx", ".json" ],
        jsnext: true,
        module: true,
        main: true
      }),
      replacePlugin(variables),
      cjsPlugin({
        include: "node_modules/**"
      }),
      yamlPlugin(),
      jsonPlugin(),
      currentTranspiler,
      transpilerId === "binary" ? executablePlugin() : null
    ].filter(Boolean)
  })
    .then((bundle) =>
      bundle.write({
        format,
        name,
        banner: transpilerId === "binary" ? `#!/usr/bin/env node\n\n${banner}` : banner,
        sourcemap: command.flags.sourcemap,
        file: outputFile
      })
    )
    .then(() => variantCallback(null))
    .catch((error) => {
      console.error(error)
      variantCallback(`Error during bundling ${format}: ${error}`)
    })
}
