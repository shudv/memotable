# memotable

## 3.3.0

### Minor Changes

- 355ddbc: Change the order of arguments in partition initializer for easier use

## 3.2.0

### Minor Changes

- cff6c4f: Simplify API surface

## 3.1.5

### Patch Changes

- 37fc579: Trim a few bytes of JS from the bundle

## 3.1.4

### Patch Changes

- 3d14fb8: Do not export print function

## 3.1.3

### Patch Changes

- d75c529: Bug fixes + trim some JS

## 3.1.2

### Patch Changes

- f0f46ef: Batch API improvements + bug fixes

    ### Bug Fixes & Improvements
    - **Batch error handling**: Exceptions during batch operations now properly revert all changes and prevent notifications
    - **Batch guards**: Structural operations (sort, index, memo) are blocked during batch execution with clear error messages
    - Misc. bug fixes for various edge cases.

## 3.1.1

### Patch Changes

- ef13428: Tweak partitions() API to make integration easier

## 3.1.0

### Minor Changes

- 0ab09d5: API usability improvements
    1. `sort()` for re-sorting without specifying comparator again
    2. `index()` for re-indenxing without specifying index again
    3. `partition()` for accessing default partition
    4. Index definitions now support-
        1. `boolean` values so that true values map to the default partition.
        2. `falsy` values that get automatically ignored.

## 3.0.1

### Patch Changes

- 2016963: Misc. bug fixes

## 3.0.0

### Major Changes

- a98422a: memotable v3 - more type-safe, map-like API with configurable memoization

    ## Release Notes v3.0.0

    ### Breaking Changes
    - **Map-like API**: MemoTable now returns iterators for `.keys()` and `.values()` methods instead of arrays. A new `toArray()` API is added for accessing an array of values in the map.
    - **Memoization**: Memoization is now opt-in for all nodes, and not turned on by default for terminal partitions.

    ### New Features
    - **Configurable memoization**: Use `.memo()` method to memoize a table node.

## 2.2.0

### Minor Changes

- 5572ce7: Add utility for pretty-printing a table

## 2.1.0

### Minor Changes

- b29bba3: Add size() API + memoize sorted values for even faster reads

## 2.0.0

### Major Changes

- 912d614: memotable v2

## 1.1.2

### Patch Changes

- 4911bce: Fix useTable export

## 1.1.1

### Patch Changes

- 8d831a4: Reduce bundle size and increase compatibility

## 1.1.0

### Minor Changes

- cd71871: Add useTable hook for easy react integration

## 1.0.2

### Patch Changes

- 8d4669b: Mark package as side-effect free

## 1.0.1

### Patch Changes

- e031a9c: Fix registry metdata and release automation

## 1.0.0

### Major Changes

- b082499: Initial public release of memotable
