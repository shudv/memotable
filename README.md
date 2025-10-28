# memotable

[![npm version](https://img.shields.io/npm/v/memotable.svg?color=007acc)](https://www.npmjs.com/package/memotable)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/memotable?label=size&color=success)](https://bundlephobia.com/package/memotable)
[![CI](https://github.com/shudv/memotable/actions/workflows/ci.yml/badge.svg)](https://github.com/shudv/memotable/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Zero dependencies.** Reactive, indexed and memoized in-memory tables and views — all in about **2 KB**.

## The Problem

Developers often reach for `useMemo` to cache filtered or sorted collections, but that quickly becomes a readability, correctness or a performance trap.

```tsx
function TaskList({ tasks, filter, comparator }) {
  // ❌ Recomputes entire list on *any* change OR risks stale data if reference doesn't change
  const filtered = useMemo(() => tasks.filter(filter), [tasks, filter]);
  const sorted = useMemo(() => filtered.sort(comparator), [filtered, comparator]);

  return <div>{sorted.map((t) => <Task key={t.id} {...t} />)}</div>;
}
```

**Problems with this approach:**
- If the collection has a stable reference across renders, `useMemo` will return stale results.
- If the collection gets a new reference every render, `useMemo` recalculates every time — defeating it's purpose.

## The Solution

`memotable` introduces **materialized views**, **incremental updates**, and **subscriptions**:

```tsx
const taskTable = new Table<Task>(); // Structure defined once
taskTable.applyFilter(filter); // ✅ Filter applied and maintained incrementally
taskTable.applyComparator(comparator); // ✅ Comparator applied and maintained incrementally

function TaskList({ taskTable }) { // ✅ Simpler React component that just renders the data in the table
  const tasks = useTable(taskTable); // ✅ Subscription that is only notified when the table gets updated (referential stability of `taskTable` is inconsequential)
  return <div>{tasks.map((t) => <Task key={t.id} {...t} />)}</div>;
}
```

**Benefits:**
- **Lighter render passes** – Filters and sorts are applied outside the render loop.
- **Less re-renders** – A table partition notified subscribers only when it sees any change (for cases when we have multiple partitions, the example above only has one).

## When should you use `memotable`?

You probably *don’t* need it for simple apps. But it shines in the middle ground between trivial and overengineered:

✅ Use it when:
- Your data set is large enough that filtering/sorting frequently can cause visible frame drops (~10ms+).
- Your data changes frequently (real-time sync, live collaboration, etc.).
- You need efficient, indexed access for reads.
- You regularly sync data to a persistent cache (e.g., IndexedDB).

🚫 Avoid it when:
- Your data set is small enough that plain `.filter()`/`.sort()` in a render pass is super fast (say <1ms) OR the number of render passes itself are low enough.
- The complexity of maintaining derived views correctly outweighs the performance gain.
- Your data-set is so huge that even a single sort/filter pass is noticeably janky (`memotable` reduces sort/filter pass but does not eliminate it entirely). At that point, consider using a web worker for heavy computation or re-design your app to not require heavy data processing on the client.

The philosophy is simple: **React components should render data, not process it.**

## What `memotable` is *not*

It’s **not** a full state management system like MobX or Zustand. Instead, it’s a **reactive data structure primitive** — designed to integrate *with* those systems or stand alone for efficient in-memory computation.

---

## Core Features

- **Recursive partitioning** – Every index creates partitions (sub-tables), which can themselves be indexed further.  
- **Materialized views** – Filtered, sorted, and materialized (memoized) partitions for fast reads. (Note that memoization is fully configurable)  
- **Incremental updates** – Changes propagate only to affected partitions.  
- **Subscriptions** – Fine-grained listeners for any node or partition.  
- **Change tracking** – Built-in `nextDelta()` for persistence and sync.  
- **Batching** – Apply multiple updates with `runBatch()`, triggering a single recalculation cycle.

## Example

See the [React Todo App example](./examples/react/TodoApp.tsx) for a complete demo that shows:

- **Indexing** – Items distributed across “List 1”, “List 2”, and “Important” views.  
- **Partition-specific sorting** – Each partition can have its own sorting rule.  
- **Reactive updates** – Real-time UI via [`useTable`](./examples/react/useTable.ts).  
- **View materialization** – Cached filtered results across re-renders.

**Quick preview:**

```tsx
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
  return <ul>{items.map((item) => <li key={item.id}>{item.title}</li>)}</ul>;
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

**Run locally:**

```bash
pnpm demo
```

## License

MIT
