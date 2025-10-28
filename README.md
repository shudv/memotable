# memotable

[![npm version](https://img.shields.io/npm/v/memotable.svg?color=007acc)](https://www.npmjs.com/package/memotable)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/memotable?label=size&color=success)](https://bundlephobia.com/package/memotable)
[![CI](https://github.com/shudv/memotable/actions/workflows/ci.yml/badge.svg)](https://github.com/shudv/memotable/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A tiny, zero-dependency, reactive data structure primitive for JavaScript that lets you build **derived**, **indexed**, and **materialized** views over mutable collections — in about **2 KBs**.

---

## Why do we need another JS library?

We don’t. I built this library not because the world needs yet another JS abstraction (it doesn’t), but because—

1. This abstraction actually proved useful in reducing JS boilerplate in real production code.
2. It felt like a clean, minimal, and elegant way to index and memoize large derived collections correctly.

---

## What it is

`memotable` is a minimal data-structure library that maintains internal indexes and derived views, propagates updates efficiently, and supports fine-grained subscriptions.

It’s **not** a full-blown state management solution like MobX or Zustand. Instead, it’s a **data structure primitive** — something you can integrate with any state management layer, or use directly when you need fast, reactive, in-memory data.

It’s built for scenarios where you maintain large collections and want derived views that **react to change** without rebuilding or diffing everything.

---

## Core ideas

- **Recursive partitioning** – Every index on a table creates partitions (sub-tables), which can themselves be indexed further.
- **Derived views** – Each table or partition can be filtered, sorted, and materialized for fast reads.
- **Incremental updates** – Changes propagate only to affected partitions, never across the whole tree.
- **Subscriptions** – Components (or consumers) can subscribe to any partition and get notified precisely when it changes.
- **Change tracking** – Built-in delta tracking via `nextDelta()` makes it easy to persist or synchronize updates.
- **Batching** – Multiple updates can be applied in a single batched operation using the `runBatch() API`, triggering just one round of index, view recalculation and subscriber notification.

---

## Example

See the [React Todo App example](./examples/react/TodoApp.tsx) for a complete implementation showing:

- **Indexing** – Items are automatically distributed across “List 1”, “List 2”, and “Important” views.
- **Path-aware sorting** – Different sort orders per partition (e.g., by creation date for lists, by due date for important items).
- **Reactive updates** – Real-time UI updates via the [`useTable`](./examples/react/useTable.ts) hook.
- **Dynamic filtering** – Keyword search across all partitions, with cached results across re-renders.

**Quick preview:**

```ts
// Partition items across multiple views
todoTable.registerIndex("View", (todo) => {
  const partitions = [];
  if (todo.isImportant) partitions.push("Important");
  partitions.push(todo.listId); // "List 1" or "List 2"
  return partitions;
});

// Different sorting per partition
todoTable.applyComparator((a, b, path) => {
  if (path.at(-1) === "Important") {
    return a.dueDate.getTime() - b.dueDate.getTime(); // Sort by due date
  }
  return a.createdDate.getTime() - b.createdDate.getTime(); // Sort by creation date
});

// React component subscribes to changes
function ListView({ table }) {
  const items = useTable(table); // Auto re-renders on changes
  return <ul>{items.map((item) => <li key={item.id}>{item.title}</li>)}</ul>;
}
```

**Run the demo:**

```bash
cd examples/react
# Open index.html in your browser
```

---

## License

MIT
