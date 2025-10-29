# memotable

[![npm version](https://img.shields.io/npm/v/memotable.svg?color=007acc)](https://www.npmjs.com/package/memotable)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/memotable?label=size&color=success)](https://bundlephobia.com/package/memotable)
[![CI](https://github.com/shudv/memotable/actions/workflows/ci.yml/badge.svg)](https://github.com/shudv/memotable/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Try it live](https://img.shields.io/badge/Try%20it-live-ff69b4)](https://codesandbox.io/p/sandbox/c9lv4v)

**Zero dependencies.** Reactive, indexed and memoized in-memory tables and views — all in **<2 KB**.  
Written in TypeScript with full type definitions. ESM + CJS compatible. Side-effects free.

> **Incremental memoization for collections.**
>
> `memotable` is not another state management library.  
> It exists because most collection memoization people do with `useMemo` or similar hooks
> is either unnecessary or wrong.  
> This library brings that to the surface — and provides the correct alternative for the few
> cases where real collection-level memoization is actually needed.

## Why memotable

Most developers reach for `useMemo` (or the equivalent in their framework)
to cache filtered or sorted lists — but for collections, that pattern is almost always a trap.

```tsx
function TaskList({ tasks, filter, comparator }) {
  // ❌ Looks efficient, but isn't.
  const filtered = useMemo(() => tasks.filter(filter), [tasks, filter]);
  const sorted = useMemo(() => filtered.sort(comparator), [filtered, comparator]);
  ...
}
```

This has two fundamental problems:
- If you mutate the array in place, `useMemo` can silently return **stale data** because the reference didn’t change.
- If you recreate the array on every render, you pay **full recomputation cost** every time — so your “optimization” does nothing.
  
Most of the time, you don’t need to “memoize” collections at all — just recompute them and move on.
But when you _do_ need to avoid recomputation — say, thousands of items with heavy filter/comparator logic —  
you need a structure that’s actually designed for that.

That’s what `memotable` is.

It provides:

- **Incremental updates** — only reprocess changed items.
- **Recursive indexing** — you can partition, filter, and index views as deeply as needed.
- **Delta tracking** — access just the changes since last read, useful for syncing.

## Using memotable

```tsx
const taskTable = new Table<Task>(); // Structure defined once
taskTable.applyFilter(filter); // ✅ Filter applied and maintained incrementally
taskTable.applyComparator(comparator); // ✅ Comparator applied and maintained incrementally

function TaskList({ taskTable }) {
    // ✅ Simpler React component that just renders the data in the table
    const tasks = useTable(taskTable); // ✅ Subscription that is only notified when the table gets updated (referential stability of `taskTable` is inconsequential)
    return (
        <div>
            {tasks.map((t) => (
                <Task key={t.id} {...t} />
            ))}
        </div>
    );
}
```

**Benefits:**

- **Lighter render passes** – Filters and sorts are applied outside the render loop.
- **Less re-renders** – A table partition notifies subscribers only when it sees any change (for cases when we have multiple partitions, the example above only has one).

## Quick Start

```bash
npm install memotable
# or
pnpm add memotable
# or
yarn add memotable
```

```ts
import { Table } from "memotable";

// Create a table
const users = new Table<{ id: number; name: string; role: string }>();

// Add items
users.insert({ id: 1, name: "Alice", role: "admin" });
users.insert({ id: 2, name: "Bob", role: "user" });

// Apply filters and sorts
users.applyFilter((user) => user.role === "admin");
users.applyComparator((a, b) => a.name.localeCompare(b.name));

// Subscribe to changes
users.subscribe(() => {
    console.log("Table updated:", users.getAll());
});

// Get filtered & sorted results
console.log(users.getAll()); // [{ id: 1, name: "Alice", role: "admin" }]
```

**React integration:**

```tsx
import { useTable } from "memotable/react";

function UserList({ table }) {
    useTable(table); // Auto-subscribes and re-renders on changes
    return (
        <ul>
            {table.items().map((user) => (
                <li key={user.id}>{user.name}</li>
            ))}
        </ul>
    );
}
```

## Live Demo

Check out the [React Todo App example](./examples/react/TodoApp.tsx) — a complete interactive demo showing indexing, partition-specific sorting, and reactive updates.

**Run it locally:**

```bash
git clone https://github.com/shudv/memotable.git
cd memotable
pnpm install
pnpm demo
```

## When should you use memotable?

You _don't_ need it for simple apps.

✅ Use it when:

- Your data set is large enough that filtering/sorting frequently can cause visible frame drops (~10ms+).
- Your data changes frequently (real-time sync, live collaboration, etc.).
- You need efficient, indexed access for reads.
- You regularly sync data to a persistent cache (e.g., IndexedDB).
- You feel uneasy with a lot of code running in render loops, even if it does not show up on performance traces.😊

## When _not_ to use memotable

🚫 Avoid it when:

- Your data set is small enough that plain `.filter()`/`.sort()` in a render pass is super fast (say <1ms) OR the number of render passes itself are naturally low enough.
- The complexity of maintaining derived views correctly outweighs the performance gain.
- Your data set is so huge that even a single sort/filter pass is noticeably janky (memotable reduces sort/filter passes but does not eliminate them entirely). At that point, consider using a web worker for heavy computation or re-design your app to not require heavy data processing on the client.

## What memotable is _not_

It's **not** a full state management system like MobX or Zustand. Instead, it's a **data structure primitive** — designed to integrate _with_ those systems or stand alone for efficient in-memory computation.

## Technical Design

Memotable uses **partitioned tables** with **incremental propagation** to achieve efficient derived views:

- **Partitioning**: Each index splits data into multiple sub-tables (partitions) based on key extraction. These partitions can themselves be indexed further, creating a recursive tree structure.
- **Incremental updates**: When items change, only affected partitions recalculate their state. Filters and sorts propagate changes without full re-computation.
- **Materialized views**: Filtered and sorted results are cached in memory for instant reads. Materialization can be toggled per partition to balance memory usage vs. read performance.
- **Subscription model**: Fine-grained listeners at any level (root table, index, or partition) receive updates only when their specific view changes.

## Benchmarks

Memotable is optimized for **read-heavy workloads**. The tradeoff: slower writes, faster reads.

### Real-world benchmark: 50,000 tasks across 50 lists with R/W ratio of 5

Scenario: 50,000 tasks with list-based indexing, importance filtering, and two-factor sorting (importance + timestamp). Simulates a typical task management app with 500 reads and 100 writes.

| Operation    | memotable   | Plain JS    | Difference       |
| ------------ | ----------- | ----------- | ---------------- |
| Initial load | 89.6ms      | 5.3ms       | 16.9x slower     |
| 100 edits    | 16.3ms      | 0.1ms       | 153.3x slower    |
| 500 reads    | 8.5ms       | 306.1ms     | **36.2x faster** |
| **Total**    | **114.4ms** | **311.6ms** | **2.7x faster**  |

_Run `pnpm benchmark` to test on your machine._

### Key insights

**When memotable wins:**

- Read-heavy workloads (read/write ratio > 5:1) — reads are 30–40x faster
- Frequent queries against the same filtered/sorted views
- Real-time UIs that re-render on every data change

**When plain JS wins:**

- Initial bulk loading — memotable is ~17x slower due to indexing overhead
- Write-heavy workloads — each edit is ~150x slower due to incremental updates
- One-time operations on small datasets (<1000 items)

## Integrations

Memotable is designed to integrate seamlessly with existing tools:

### React

```tsx
import { useTable } from "memotable/react";

function MyComponent({ table }) {
    useTable(table); // Auto-subscribes, triggers re-render on change and cleans up on unmount
    return <div>{table.items().length} items</div>;
}
```

### Vue / Svelte (WIP)

_Coming soon_

## License

MIT

**Next steps:**

- 📖 [Read the full example](./examples/react/TodoApp.tsx)
- 🚀 [Try it live](https://codesandbox.io/p/sandbox/c9lv4v)
- 💬 [Open an issue](https://github.com/shudv/memotable/issues) or contribute on GitHub
