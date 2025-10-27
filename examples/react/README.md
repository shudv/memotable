# React Integration Examples

This directory contains example React components demonstrating how to use `memotable` with React.

## `useTable` Hook

A custom React hook that integrates memotable with React's `useSyncExternalStore`.

### Basic Usage

```tsx
import { useTable } from "./examples/react/useTable";
import { Table } from "memotable";

const myTable = new Table({
    name: "users",
    isEqual: (a, b) => a.id === b.id,
    deltaTracking: true,
    shouldMaterialize: () => true,
});

function UserList() {
    const users = useTable(myTable);

    return (
        <ul>
            {users.map((user) => (
                <li key={user.id}>{user.name}</li>
            ))}
        </ul>
    );
}
```

### Selector Pattern

Use `useTableSelector` to subscribe to derived values and prevent unnecessary re-renders:

```tsx
import { useTableSelector } from "./examples/react/useTable";

function UserStats() {
    // Only re-renders when the count changes, not when individual users change
    const userCount = useTableSelector(myTable, (users) => users.length);
    const activeCount = useTableSelector(myTable, (users) => users.filter((u) => u.active).length);

    return (
        <div>
            <p>Total: {userCount}</p>
            <p>Active: {activeCount}</p>
        </div>
    );
}
```

## Running the Examples

The examples are for demonstration purposes and are not included in the published npm package.

To use these patterns in your own React app:

1. Copy `useTable.ts` to your project
2. Install React 18+ (for `useSyncExternalStore` support)
3. Use the hooks as shown above

## Files

- **`useTable.ts`** - Custom React hooks for table integration
- **`TodoApp.tsx`** - Complete todo app example
- **`README.md`** - This file

# React Todo Demo

This demo showcases the Table abstraction with partition-based filtering and sorting.

## Features

- Three simultaneous list views:
    - **List 1**: Todos sorted by created date
    - **List 2**: Todos sorted by created date
    - **Important**: Important items from both lists sorted by due date

- Partition-based indexing using `registerIndex`
- Dynamic filtering/sorting based on partition path
- Easy scaling: add/remove todos with buttons

## Running the Demo

```bash
npm install
npm run dev
```

Then open `TodoDemo.tsx` in your development environment.

## How It Works

1. **Partition Index**: Each todo belongs to multiple partitions based on `getPartitions()`
2. **Dynamic Sorting**: `applyFilter()` applies different sort orders based on the partition path
3. **Reactive Views**: Each `ListView` subscribes to its partition and updates automatically
4. **Scalability**: Use buttons to easily add/remove todos and see real-time updates
