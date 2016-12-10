import { createHelper } from "./createLatestConfig"

const additionalPresets = [
  "react"
]

const additionalPlugins = [
  // Transform JSX and prefer built-in methods
  [ "transform-react-jsx", { useBuiltIns: true }],

  // Optimization: hoist JSX that never changes out of render()
  "transform-react-constant-elements",

  // Optimization: wrap propTypes into environment checks
  "transform-react-remove-prop-types"
]

export default function createReactConfig() {
  return {
    classic: createHelper(false, additionalPresets, additionalPlugins),
    modern: createHelper(true, additionalPresets, additionalPlugins)
  }
}
