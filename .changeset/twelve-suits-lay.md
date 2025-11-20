---
"memotable": minor
---

API usability improvements

1. `sort()` for re-sorting without specifying comparator again
2. `index()` for re-indenxing without specifying index again
3. `partition()` for accessing default partition
4. Index definitions now support-
    1. `boolean` values so that true values map to the default partition.
    2. `falsy` values that get automatically ignored.
