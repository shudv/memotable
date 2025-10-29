# memotable

[![npm version](https://img.shields.io/npm/v/memotable.svg?color=007acc)](https://www.npmjs.com/package/memotable)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/memotable?label=size&color=success)](https://bundlephobia.com/package/memotable)
[![CI](https://github.com/shudv/memotable/actions/workflows/ci.yml/badge.svg)](https://github.com/shudv/memotable/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Try it live](https://img.shields.io/badge/Try%20it-live-ff69b4)](https://codesandbox.io/p/sandbox/c9lv4v)

**Zero dependencies.** Reactive, indexed and memoized in-memory tables and views — all in **<2 KB**. Written in TypeScript with full type definitions. ESM + CJS compatible. Side-effects free.

Memotable is a **reactive data structure** for managing filtered, sorted, and indexed collections with **incremental updates** and **materialized views**. Think of it as an in-memory database engine optimized for reactive state management in JavaScript applications.

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Quick Start](#quick-start)
- [Live Demo](#live-demo)
- [When should you use memotable?](#when-should-you-use-memotable)
- [When _not_ to use memotable](#when-not-to-use-memotable)
- [What memotable is _not_](#what-memotable-is-not)
- [Technical Design](#technical-design)
- [Core Features](#core-features)
- [Examples](#examples)
    - [Vanilla JavaScript](#vanilla-javascript-reactive-tables-for-derived-views)
    - [React Integration](#react-integration-with-derived-views)
    - [Batching for Performance](#batching-for-performance)
- [Benchmarks](#benchmarks)
- [Ecosystem Integrations](#ecosystem-integrations)
- [API Reference](#api-reference)
- [License](#license)

## The Problem

Developers often reach for `useMemo` to cache filtered or sorted collections, but that quickly becomes a readability, correctness or a performance trap.

```tsx
function TaskList({ tasks, filter, comparator }) {
    // ❌ Recomputes entire list on *any* change OR risks stale data if reference doesn't change
    const filtered = useMemo(() => tasks.filter(filter), [tasks, filter]);
    const sorted = useMemo(() => filtered.sort(comparator), [filtered, comparator]);

    return (
        <div>
            {sorted.map((t) => (
                <Task key={t.id} {...t} />
            ))}
        </div>
    );
}
```

**Problems with this approach:**

- If you mutate the collection in place (keeping the same array reference), `useMemo` can return _stale_ results because its cache key hasn’t changed.
- If you create a new array reference on every render pass, `useMemo` will recompute on every render — defeating its purpose.

## The Solution

`memotable` introduces **materialized views**, **incremental updates**, and **subscriptions**:

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

You probably _don't_ need it for simple apps. But it shines in the middle ground between trivial and overengineered:

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

It's **not** a full state management system like MobX or Zustand. Instead, it's a **reactive data structure primitive** — designed to integrate _with_ those systems or stand alone for efficient in-memory computation.

## Technical Design

Memotable uses **partitioned tables** with **incremental propagation** to achieve efficient derived views:

- **Partitioning**: Each index splits data into multiple sub-tables (partitions) based on key extraction. These partitions can themselves be indexed further, creating a recursive tree structure.
- **Incremental updates**: When items change, only affected partitions recalculate their state. Filters and sorts propagate changes without full re-computation.
- **Materialized views**: Filtered and sorted results are cached in memory for instant reads. Materialization can be toggled per partition to balance memory usage vs. read performance.
- **Subscription model**: Fine-grained listeners at any level (root table, index, or partition) receive updates only when their specific view changes.

This design minimizes redundant computation while keeping the API surface simple: insert, update, delete, applyFilter, applyComparator, and subscribe.

## Core Features

- **Recursive partitioning** – Every index creates partitions (sub-tables), which can themselves be indexed further.
- **Materialized views** – Filtered, sorted, and materialized (memoized) partitions for fast reads. _(Note: materializing a view caches results for faster reads but increases memory usage; materialization can be enabled/disabled individually for every partition)_
- **Incremental updates** – Changes propagate only to affected partitions.
- **Subscriptions** – Fine-grained listeners for any node or partition.
- **Change tracking** – Built-in `nextDelta()` for persistence and sync.
- **Batching** – Apply multiple updates with `runBatch()`, triggering a single recalculation cycle.

## Examples

### React integration with derived views

See the [React Todo App example](./examples/react/TodoApp.tsx) for a complete demo that shows:

- **Indexing** – Items distributed across “List 1”, “List 2”, and “Important” views.
- **Partition-specific sorting** – Each partition can have its own sorting rule.
- **Reactive updates** – Real-time UI via [`useTable`](./src/integrations/react/useTable.tsx).
- **View materialization** – Cached filtered results across re-renders.

**Quick preview:**

```tsx
import { Table } from "memotable";
import { useTable } from "memotable/react";

const todoTable = new Table<ITask>();

todoTable.registerIndex("View", (todo) => {
    const partitions = [];
    if (todo.isImportant) partitions.push("Important");
    partitions.push(todo.listId);
    return partitions;
});

const viewIndex = todoTable.index("View");

todoTable.applyComparator((a, b, path) => {
    if (path.at(-1) === "Important") {
        return a.dueDate.getTime() - b.dueDate.getTime();
    }
    return a.createdDate.getTime() - b.createdDate.getTime();
});

function ListView({ table }) {
    const items = useTable(table);
    return (
        <ul>
            {items.map((item) => (
                <li key={item.id}>{item.title}</li>
            ))}
        </ul>
    );
}

function App() {
    return (
        <>
            <ListView table={viewIndex.partition("List 1")} />
            <ListView table={viewIndex.partition("List 2")} />
            <ListView table={viewIndex.partition("Important")} />
        </>
    );
}
```

### Batching for performance

When making multiple updates, use `runBatch()` to trigger a single recalculation:

```ts
import { Table, runBatch } from "memotable";

const users = new Table<User>();
users.applyComparator((a, b) => a.name.localeCompare(b.name));

// ❌ Without batching: 3 separate recalculations
users.insert({ id: 1, name: "Charlie" });
users.insert({ id: 2, name: "Alice" });
users.insert({ id: 3, name: "Bob" });

// ✅ With batching: 1 recalculation after all inserts
runBatch(() => {
    users.insert({ id: 1, name: "Charlie" });
    users.insert({ id: 2, name: "Alice" });
    users.insert({ id: 3, name: "Bob" });
});

// Result: Subscribers notified once with fully updated state
```

**Performance impact**: For bulk operations (e.g., syncing 1000 items from a server), batching can reduce recalculation overhead by 10–100x depending on complexity of filters, sorts, and indexes.

## Benchmarks

Memotable is designed for datasets in the **hundreds to tens of thousands** of items where incremental updates outperform full recomputation.

**Example scenario:** 10,000 items with 3 indexes, 2 filters, and 1 sort comparator.

| Operation                           | memotable (incremental) | Plain JS (full recompute) |
| ----------------------------------- | ----------------------- | ------------------------- |
| Insert 1 item                       | ~0.05ms                 | ~8ms                      |
| Update 1 item (no partition change) | ~0.03ms                 | ~8ms                      |
| Delete 1 item                       | ~0.04ms                 | ~8ms                      |
| Batch insert 100 items              | ~2ms                    | ~8ms                      |

_Benchmarks run on M1 MacBook Pro. Your mileage may vary. Run `pnpm benchmark` to test on your machine._

**Key takeaway**: Memotable shines when you have frequent small updates to medium-large datasets. For one-time bulk operations on small datasets, plain JavaScript is often faster due to lower overhead.

## Ecosystem Integrations

Memotable is designed to integrate seamlessly with existing tools:

### React

```tsx
import { useTable } from "memotable/react";

function MyComponent({ table }) {
    const items = useTable(table); // Auto-subscribes, triggers re-render on change and clean-up on unmount
    return <div>{items.length} items</div>;
}
```

### IndexedDB / LocalStorage

Use `nextDelta()` for efficient persistence:

```ts
const delta = table.nextDelta();
if (delta) {
    await db.put("deltas", { timestamp: Date.now(), changes: delta });
}
```

This captures only **changed items** since the last call, making it ideal for incremental sync patterns.

## License

MIT

**Next steps:**

- 📖 [Read the full example](./examples/react/TodoApp.tsx)
- 🚀 [Try it live](https://codesandbox.io/p/sandbox/c9lv4v)
- 💬 [Open an issue](https://github.com/shudv/memotable/issues) or contribute on GitHub
