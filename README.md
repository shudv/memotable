# memotable

A tiny reactive data engine for JavaScript that lets you build **derived**, **indexed**, and **materialized** views over mutable collections — in about **1.5 KB**.

## Why do we need another JS library?

We don't. I created this library not because someone might need it (they most likely don't) but because-

1. This library/abstraction did prove to be helpful in reducing JS boilerplate in real production use cases.
1. The abstraction felt minimal/elegant for correctly indexing and memoizing large derived collections.

---

## What it is

`memotable` is a minimal data-structure library that maintains internal indexes and derived views, propagates updates efficiently, and supports fine-grained subscriptions.

It’s designed for scenarios where you want large in-memory tables and derived views that **react to change** without rebuilding or diffing everything.

---

## Core ideas

- **Recursive partitioning** – Every index creates sub-tables that can be indexed further.
- **Derived views** – Tables can define filtered, sorted, or materialized projections.
- **Incremental updates** – Changes propagate precisely to affected partitions and views.
- **Subscriptions** – Components can subscribe to any node in the structure.
- **Change tracking** – Built-in delta tracking via `nextDelta()` for persistence or sync.

Everything stays local, predictable, and memory-efficient.

---

## Example

See the complete [React Todo App example](./examples/react/TodoApp.tsx) for a full implementation demonstrating:

- **Multi-dimensional indexing**: Items automatically distributed across "List 1", "List 2", and "Important" views
- **Path-aware sorting**: Different sort orders per partition (created date for lists, due date for important items)
- **Reactive updates**: Real-time UI updates via the [`useTable` hook](./examples/react/useTable.ts)
- **Dynamic filtering**: Keyword search across all partitions
- **Partition-based views**: Each list renders independently while sharing the same data source

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
    return a.createdDate.getTime() - b.createdDate.getTime(); // Sort by created date
});

// React component subscribes to changes
function ListView({ table }) {
    const items = useTable(table); // Auto re-renders on changes
    return <ul>{items.map(item => <li>{item.title}</li>)}</ul>;
}
```

**Run the demo:**

```bash
cd examples/react
# Open index.html in your browser
```

## License

MIT
