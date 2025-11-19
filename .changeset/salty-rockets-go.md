---
"memotable": major
---

memotable v3 - more type-safe, map-like API with configurable memoization

## Release Notes v3.0.0

### Breaking Changes

- **Map-like API**: MemoTable now returns iterators for `.keys()` and `.values()` methods instead of arrays. A new `toArray()` API is added for accessing an array of values in the map.
- **Memoization**: Memoization is now opt-in for all nodes, and not turned on by default for terminal partitions.

### New Features

- **Configurable memoization**: Use `.memo()` method to memoize a table node.
