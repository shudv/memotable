# memotable

A tiny reactive data engine for JavaScript that lets you build **derived**, **indexed**, and **materialized** views over mutable collections — in about **1.5 KB**.

## Why do we need another JS library?

We don't. I created this library not because someone might need it (they most likely don't) but because-

1. This library/abstraction did prove to be helpful in reducing JS boilerplate in real production use cases.
1. The abstraction felt minimal/elegant for correctly indexing and memoizing large derived collections.

---

## What it is

`memotable` is a minimal data-structure library that maintains internal indexes and derived views, propagates updates efficiently, and supports fine-grained subscriptions.

It’s designed for scenarios where you want in-memory tables and derived views that **react to change** without rebuilding or diffing everything.

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

```ts
import { Table } from "memotable";

// Create a base table
const tasks = new Table<Task>();

// Add tasks
tasks.add({ id: "1", listId: "inbox", title: "Buy milk" });
tasks.add({ id: "2", listId: "work", title: "Send report" });

// Create an index by listId
const byList = tasks.index("listId");

// Access a sub-table (partition)
const inbox = byList.partition("inbox");

// Subscribe to changes in that partition
inbox.subscribe(() => {
    console.log("Inbox changed");
});

// Modify an item
tasks.update("1", { title: "Buy oat milk" });

// Pull incremental deltas
const changed = tasks.nextDelta();
console.log(changed); // ['1']
```

---

## Install

```bash
pnpm add memotable
```

or

```bash
npm install memotable
```

---

## Why it exists

Most state libraries handle _what changed_, not _where it changed_.  
`memotable` flips that: it models _structure_ as first-class, so derived collections update themselves with minimal work.

If you think of reactivity like dependency graphs — this is that, but for data tables.

---

## Size

| Build    | Brotli      | Description                |
| -------- | ----------- | -------------------------- |
| ESM      | **1.54 KB** | Full reactive table engine |
| Minified | ~1.7 KB     | Production-ready           |
| Source   | ~3 KB       | TypeScript                 |

Zero dependencies.

---

## API surface (core)

| Interface            | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `ITable<T>`          | Mutable data table                        |
| `IReadOnlyTable<T>`  | Non-mutating read interface               |
| `IIndex<T>`          | Manages partitions by key                 |
| `IDeltaTrackedTable` | Exposes `nextDelta()` for change tracking |

---

## Naming conventions

- `_` prefix indicates internal fields that can be safely mangled in builds.
- Private methods (`#`) are internal, not part of the public surface.
- Recursive structures always return `IReadOnlyTable<T>` to prevent accidental mutation from sub-views.

---

## Design philosophy

Small surface, high leverage.  
No magic. No runtime overhead.  
Everything is explicit, local, and composable.

---

## React Integration

`memotable` works seamlessly with React via `useSyncExternalStore`. See the [React examples](./examples/react/) for complete implementations.

### Quick Start

```tsx
import { useSyncExternalStore } from "react";
import { Table } from "memotable";

// Create a custom hook
function useTable<T>(table: IReadOnlyTable<T>): T[] {
    return useSyncExternalStore(
        (callback) => table.onChange(callback),
        () => table.getAll(),
        () => table.getAll()
    );
}

// Use in your component
function TodoList() {
    const todos = useTable(todoTable);

    return (
        <ul>
            {todos.map((todo) => (
                <li key={todo.id}>{todo.text}</li>
            ))}
        </ul>
    );
}
```

For complete working examples including a Todo app, see [`examples/react/`](./examples/react/).

---

## License

MIT
