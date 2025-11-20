# Edge Cases and Tricky Scenarios - Test Results

This document summarizes the comprehensive edge case testing performed on the memotable library. We created 45 tests exploring tricky scenarios to ensure the library's correctness and identify potential gotchas for users.

## Test Results Summary

✅ **All 45 edge case tests pass**
✅ **100% code coverage maintained**
✅ **6 surprising behaviors documented**

## Discovered Edge Cases

### 1. Empty String Partition Names are Filtered Out

**File:** `Table.edgecases.test.ts` - Line 98

**Behavior:**
When indexing by an array of partition names, empty strings are filtered out by the internal `filter(Boolean)` call.

**Example:**

```typescript
table.index((value) => value.tags);
table.set("1", { tags: ["", "valid"] });

table.partition("").size; // Returns 0, not 1!
table.partition("valid").size; // Returns 1
```

**Implication:**
Users cannot partition data by empty strings. This might be unexpected if empty string is a meaningful partition key in their domain.

---

### 2. Memoized Arrays are Mutable (Not Defensively Copied)

**File:** `Table.edgecases.test.ts` - Line 240

**Behavior:**
When memoization is enabled, `toArray()` returns a direct reference to the internal memoized array. Mutating this array affects the table's internal state.

**Example:**

```typescript
table.sort((a, b) => a.age - b.age);
table.memo(true);

const array1 = table.toArray();
const array2 = table.toArray();

array1 === array2; // true - same reference!

// Mutating the returned array affects internal state!
array1.push({ name: "Charlie", age: 35 });

table.toArray().length; // Now returns 3 instead of 2
```

**Implication:**
The return type is declared as `readonly V[]` but is not defensively copied for performance reasons. Users MUST treat returned arrays as readonly and not mutate them. This is a potential footgun.

**Recommended Fix:**
Either:

1. Defensively copy the array before returning (impacts performance)
2. Document this behavior prominently in the API docs
3. Return a frozen array `Object.freeze(this._sortedValues)`

---

### 3. Nested Batches Notify Independently

**File:** `Table.edgecases.test.ts` - Line 265

**Behavior:**
When batches are nested, each batch completes and notifies subscribers independently. The inner batch gets all accumulated changes, then the outer batch gets remaining changes.

**Example:**

```typescript
const subscriber = vi.fn();
table.subscribe(subscriber);

table.batch((t1) => {
    t1.set("1", { title: "Task 1" });

    t1.batch((t2) => {
        t2.set("2", { title: "Task 2" });
        t2.set("3", { title: "Task 3" });
    }); // Notifies with ["1", "2", "3"]

    t1.set("4", { title: "Task 4" });
}); // Notifies with ["4"]

// subscriber was called TWICE, not once
```

**Implication:**
Nested batches are not coalesced into a single notification. This could lead to unexpected multiple notifications if batches are accidentally nested.

---

### 4. Exceptions During Batch Prevent Notification

**File:** `Table.edgecases.test.ts` - Line 290

**Behavior:**
If an exception is thrown during a batch operation, the changes made before the exception are persisted, but subscribers are NOT notified.

**Example:**

```typescript
const subscriber = vi.fn();
table.subscribe(subscriber);

try {
    table.batch((t) => {
        t.set("1", { title: "Task 1" });
        t.set("2", { title: "Task 2" });
        throw new Error("Something went wrong");
    });
} catch (e) {
    // Changes are persisted
    table.has("1"); // true
    table.has("2"); // true

    // But subscriber was NOT notified!
    subscriber.toHaveBeenCalledTimes(0);
}
```

**Implication:**
Subscribers can become out of sync with table state if batch operations throw exceptions. This could lead to stale UI or missed updates.

**Recommended Fix:**
Consider using try/finally to ensure notification happens even if the batch throws:

```typescript
public batch(fn: (t: TBatchable<K, V>) => void): void {
    this._isBatchOperationInProgress = true;
    try {
        fn(this);
    } finally {
        this._isBatchOperationInProgress = false;
        if (this._keysUpdatedInCurrentBatch.size > 0) {
            this._propagateChanges(this._keysUpdatedInCurrentBatch);
            this._keysUpdatedInCurrentBatch.clear();
        }
    }
}
```

---

### 5. Iterators are "Live" and See Modifications

**File:** `Table.edgecases.test.ts` - Line 435

**Behavior:**
When iterating over keys/values/entries, modifications made during iteration are visible to the iterator. This is standard Map behavior.

**Example:**

```typescript
table.set("1", { title: "Task 1" });
table.set("2", { title: "Task 2" });
table.set("3", { title: "Task 3" });

const keys = [];
for (const key of table.keys()) {
    keys.push(key);
    if (key === "2") {
        table.set("4", { title: "Task 4" }); // Add during iteration
    }
}

keys; // ["1", "2", "3", "4"] - sees the newly added item!
```

**Implication:**
Users need to be careful about modifying tables during iteration. This can lead to infinite loops or unexpected behavior if not handled carefully.

---

### 6. Touch Always Notifies (Even for Non-Existent Keys)

**File:** `Table.edgecases.test.ts` - Line 499

**Behavior:**
Calling `touch(key)` on a non-existent key still triggers subscriber notifications, even though nothing actually changed.

**Example:**

```typescript
const subscriber = vi.fn();
table.subscribe(subscriber);

table.touch("nonexistent");

// Subscriber is notified even though key doesn't exist!
subscriber.toHaveBeenCalledWith(["nonexistent"]);
```

**Implication:**
This could lead to unnecessary re-renders or updates when touching keys that don't exist. Users might expect `touch()` to be a no-op for non-existent keys.

**Recommended Fix:**
Add a check in the `touch()` method:

```typescript
public touch(key: K): void {
    if (this._map.has(key)) {
        this._propagateChanges([key]);
    }
}
```

---

## Additional Tests Covered

### Sorting Edge Cases

- ✅ Sorting with NaN values
- ✅ Sorting with undefined and null values
- ✅ Sorting stability with equal values
- ✅ Comparators that return non-numeric values
- ✅ Sorting after clear() and re-adding data

### Indexing Edge Cases

- ✅ Special characters in partition names (spaces, slashes, newlines, tabs)
- ✅ Re-indexing with changed definitions
- ✅ Dynamic partition names (indexing based on external config)
- ✅ Values belonging to many partitions simultaneously
- ✅ Null and undefined in partition names arrays

### Memoization Edge Cases

- ✅ Memory leaks with frequent updates (1000 add/delete cycles)
- ✅ Memoization toggling multiple times

### Batching Edge Cases

- ✅ Empty batches (no operations)
- ✅ Batches with only failed deletes
- ✅ Set, delete, set of same key in one batch

### Special Keys Edge Cases

- ✅ undefined as a key
- ✅ null as a key
- ✅ Symbol as a key
- ✅ Object as a key (reference equality)
- ✅ NaN as a key (Map handles specially)
- ✅ +0 and -0 as keys (treated as same)

### Iterator Edge Cases

- ✅ Modifying via forEach during iteration
- ✅ Iterator with memoized sorted table

### Touch Edge Cases

- ✅ Touching deleted keys
- ✅ Touching many keys in a batch
- ✅ Touch propagation through nested partitions

### Subscription Edge Cases

- ✅ Unsubscribing during notification callback
- ✅ Multiple subscribers with selective unsubscribing
- ✅ Subscriber that throws errors
- ✅ Subscribing to non-existent partitions
- ✅ Cascade notifications in nested partitions

### Complex Interaction Edge Cases

- ✅ Sorting + indexing + memoization together
- ✅ Changing values that affect multiple indexed partitions
- ✅ Large scale stress test (1000 items, 10 batches)
- ✅ Circular-like references in index definitions
- ✅ Index definitions returning variable-length arrays
- ✅ Many empty partitions (1000+)
- ✅ Deeply nested partitions (3 levels)
- ✅ Partition inheriting sorting from parent

## Recommendations

1. **Document Edge Case #2** prominently in the README - memoized arrays should not be mutated
2. **Consider fixing Edge Case #4** - ensure notifications happen even when batches throw
3. **Consider fixing Edge Case #6** - make touch() a no-op for non-existent keys
4. **Add warnings** for edge case #3 about nested batches
5. **Consider adding** defensive copying for memoized arrays (with performance caveat)

## Running the Tests

```bash
# Run all edge case tests
pnpm test Table.edgecases.test.ts

# Run all tests including edge cases
pnpm test
```

All tests pass and maintain 100% code coverage of the Table implementation.
