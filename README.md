# memotable

[![npm version](https://img.shields.io/npm/v/memotable.svg?color=007acc)](https://www.npmjs.com/package/memotable)
[![Bundle size](https://deno.bundlejs.com/badge?q=memotable)](https://deno.bundlejs.com/badge?q=memotable)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/memotable?label=size&color=success)](https://bundlephobia.com/package/memotable)
[![CI](https://github.com/shudv/memotable/actions/workflows/ci.yml/badge.svg)](https://github.com/shudv/memotable/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Try it live](https://img.shields.io/badge/Try%20it-live-ff69b4)](https://codesandbox.io/p/sandbox/c9lv4v)

Reactive, recursively-indexable, sortable and memoizable maps — all in **~1 KB**.  
Written in TypeScript with full type definitions. Side-effects free.

> **The correct way to memoize sorted & filtered keyed-collections.**
>
> Most web apps don’t need collection memoization. The DOM is almost always the real bottleneck for performance.  
> That said, when you are processing huge amounts of data (e.g. a realtime dashboard or a fully-offline app), `memotable` gives you the _correct_ memoizable primitive.

## Why memotable?

When writing React code, most developers reach for `useMemo` to cache filtered or sorted collections - but that pattern is a subtle trap.

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

Most of the time, you don’t need to “memoize” collections at all — just recompute them and move on. But when you _do_ need to avoid recomputation — say, thousands of values with heavy indexing/comparator logic — you need a structure that’s actually designed for that.

That’s what `memotable` is.

It provides:

- **Indexing** — Index collections as deeply as needed.
- **Sorting** — Sort at the root or any child node - applies recursively from any node to its children.
- **Subscriptions** — Subscribe only to the specific partition you are interested in, ignoring other changes.

## Using memotable

Simple indexing and sorting in a React component

```tsx
const taskTable = new Table<string, Task>();

function setupTable() {
    // ✅ Comparator applied and maintained incrementally
    taskTable.sort((task1, task2) => task1.title.localeCompare(task2.title));

    // ✅ Index + memo enables fast per list reads
    taskTable.index(
        (task) => task.listId,
        (_, list) => list.memo(),
    );
}

// ✅ Generic React component that renders a table of tasks
function TaskList({ taskTable }) {
    useTable(taskTable); // ✅ Subscription that is only notified when this table gets updated
    return (
        <div>
            {taskTable.toArray().map((t) => (
                <Task key={t.id} {...t} />
            ))}
        </div>
    );
}

// Render lists
<TaskList taskTable={taskTable.partition("list1")} />;
<TaskList taskTable={taskTable.partition("list2")} />;

// Update task table
taskTable.set("1", { listId: "list1", title: "Task" }); // only re-renders "list1" node
```

Complex nested index, sorting and conditional memoization

```ts
type Location = {
    id: string;
    country: string;
    region: string;
    city: string;
    district: string;
    population: number;
};

table = new Table<string, Location>();

// Define complex multi-level hierarchical partitioning
table.index(
    () => ["nested", "byCountry", "byCity"], // 3 top level partitions
    (name, partition) => {
        switch (name) {
            case "nested":
                partition.index(
                    // Nested level 1: Index by country
                    (l) => l.country,
                    (_, country) => {
                        // Nested level 2: Within each country, index by region
                        country.index(
                            (l) => l.region,
                            (_, region) => {
                                // Nested level 3: Within each region, index by city
                                region.index(
                                    (l) => l.city,
                                    (_, city) => {
                                        // Sort each city partition by population
                                        city.sort((a, b) => b.population - a.population);
                                    },
                                );
                            },
                        );
                    },
                );
                break;
            case "byCountry":
                partition.index(
                    (l) => l.country,
                    (countryName, country) => {
                        // Sort each country partition by population
                        country.sort((a, b) => b.population - a.population);

                        // IMPORTANT: Memoize only (large + frequently read) partitions
                        if (countryName === "India" || countryName === "USA") {
                            country.memo();
                        }
                    },
                );
                break;
            case "byCity":
                partition.index(
                    (l) => l.city,
                    (_, city) => {
                        // Sort each city partition by name
                        city.sort((a, b) => a.city.localeCompare(b.city));
                    },
                );
                break;
        }
    },
);
```

**Benefits:**

- **Lighter render passes** – Heavy operations like sorting and indexing are applied outside the render loop.
- **Less re-renders** – A table partition notifies subscribers only when it sees any change.

## Quick Start

```bash
npm install memotable
# or
pnpm add memotable
# or
yarn add memotable
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

- Your data set is large enough that filtering/sorting frequently can cause visible frame drops (~10ms+). (typically heavy realtime dashboards OR fully-offline apps)
- Reads outnumber writes by at least 2-3x.

## When _not_ to use memotable

🚫 Avoid it when:

- Your data set is small enough that plain `.filter()`/`.sort()` in a render pass is super fast (say <1ms) OR the number of render passes itself are naturally low enough.
- The complexity of maintaining derived views correctly outweighs the performance gain.
- Your data set is so huge that even a single sort/filter pass is noticeably janky (memotable reduces sort/filter passes but does not eliminate them entirely). At that point, consider using a web worker for heavy computation or re-design your app to not require heavy data processing on the client.

## What memotable is _not_

It's **not** a full state management system like MobX or Zustand. Instead, it's a **data structure primitive** — designed to integrate _with_ those systems or stand alone for efficient in-memory computation.

## Benchmarks

Memotable is optimized for **read-heavy workloads**. The tradeoff: slower writes, faster reads.

### Real-world benchmark

Scenario: 50 lists with 1000 tasks per list with list-based indexing, importance filtering, and two-factor sorting (importance + timestamp). Simulates a typical task management app with 400 reads and 100 writes.

| Operation    | vanilla     | memotable  | Difference      |
| ------------ | ----------- | ---------- | --------------- |
| Initial load | 3.0ms       | 35.0ms     |                 |
| 200 edits    | 0.0ms       | 30.3ms     |                 |
| 800 reads    | 244.7ms     | 3.7ms      |                 |
| **Total**    | **247.8ms** | **68.9ms** | **3.6x faster** |

_Run `pnpm benchmark` to test on your machine._

## Integrations

Memotable is designed to integrate seamlessly with existing tools:

### React

```tsx
import { useTable } from "memotable/react";

function MyComponent({ table }) {
    useTable(table); // Auto-subscribes, triggers re-render on change and cleans up on unmount
    return <div>{table.size()} values</div>;
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
