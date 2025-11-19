# memotable

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
