import babel from "rollup-plugin-babel"
import presetEdge from "babel-preset-edge"

/* eslint-disable max-params */
export function createHelper({
  mode = "classic",
  minified = false,
  presets = [],
  plugins = []
}) {
  const additionalPlugins = plugins.concat()
  const additionalPresets = presets.concat()

  let selectedPreset
  if (mode === "modern") {
    selectedPreset = [
      presetEdge,
      {
        target: "modern",
        compression: minified
      }
    ]
  } else if (mode === "es2015") {
    selectedPreset = [
      presetEdge,
      {
        target: "es2015",
        compression: minified
      }
    ]
  } else if (mode === "binary") {
    selectedPreset = [
      presetEdge,
      {
        target: "node",
        compression: minified,
        modules: false
      }
    ]
  } else {
    selectedPreset = [
      presetEdge,
      {
        target: "library",
        compression: minified
      }
    ]
  }

  return babel({
    // Don't try to find .babelrc because we want to force this configuration.
    babelrc: false,

    // Use runtime helpers as implemented by edge preset
    runtimeHelpers: true,

    // Do not transpile external code
    // https://github.com/rollup/rollup-plugin-babel/issues/48#issuecomment-211025960
    exclude: [ "node_modules/**", "**/*.json" ],

    presets: [
      selectedPreset,

      // All manually or minification related presets
      ...additionalPresets
    ],

    plugins: [
      // All manually or minification related plugins
      ...additionalPlugins
    ]
  })
}

export default function createBabelConfig(options) {
  return {
    es5: createHelper({ ...options, mode: "es5" }),
    es2015: createHelper({ ...options, mode: "es2015" }),
    modern: createHelper({ ...options, mode: "modern" }),
    binary: createHelper({ ...options, mode: "binary" })
  }
}
