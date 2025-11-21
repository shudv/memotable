---
"memotable": patch
---

Batch API improvements + bug fixes

### Bug Fixes & Improvements

- **Batch error handling**: Exceptions during batch operations now properly revert all changes and prevent notifications
- **Batch guards**: Structural operations (sort, index, memo) are blocked during batch execution with clear error messages
- Misc. bug fixes for various edge cases.
