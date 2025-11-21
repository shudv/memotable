---
"memotable": minor
---

Batch API improvements + bug fixes

## Key Changes

### Major Changes

- **Batch API redesign**: `batch()` now receives a separate `IBatch<K, V>` interface instead of the table itself, preventing structural changes (sort/index/memo) during batch operations
- **Renamed utility**: `print()` renamed to `toString()` which now returns a string instead of printing to console

### Bug Fixes & Improvements

- **Batch error handling**: Exceptions during batch operations now properly revert all changes and prevent notifications
- **Batch guards**: Structural operations (sort, index, memo) are blocked during batch execution with clear error messages
- **clear() implementation**: Now uses batch internally for proper change tracking and notifications
- **Better test utilities**: Fixed vitest custom matchers to display iterable values correctly in error messages

### Enhanced Test Coverage

Added comprehensive tests for:

- Multiple subscriber management and selective unsubscription
- Memoization toggling stability
- Deep nested indexing (3+ levels)
- Edge cases: empty partitions, special characters, null/undefined handling
- Partition inheritance of parent sorting
- Sort stability with equal values
- Batch edge cases: empty batches, exception handling, mixed operations
- Touch propagation through nested partitions

### Internal Improvements

- Introduced `IBatchableTable` and `IBatch` contracts for cleaner separation of concerns
- Removed `TBatchable` type in favor of explicit `IBatch` interface
- Batch tracking now uses dedicated `Batch` class instead of flags and sets
