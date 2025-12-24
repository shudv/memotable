// React
import { useState, useCallback } from "react";

// Table
import { Table } from "../../src/Table";
import { useTable } from "../../src/integrations/react";

// Models
import { ITodo } from "./ITodo";

// Styles
import { styles } from "./PerfApp.styles";

const INITIAL_TASK_COUNT = 200000;

// Word repository for generating readable task names
const TASK_TITLES = [
    "Pick up groceries",
    "Finish the report",
    "Call the bank",
    "Schedule dentist appointment",
    "Plan weekend trip",
    "Organize workspace",
    "Read new book",
];

// Sorting function that sorts by due date, then title, then importance
const ThreeFactorSort: (todo1: ITodo, todo2: ITodo) => number = (todo1, todo2) => {
    const dateDiff = todo1.dueDate.getTime() - todo2.dueDate.getTime();
    if (dateDiff !== 0) return dateDiff;

    const titleDiff = todo1.title.localeCompare(todo2.title);
    if (titleDiff !== 0) return titleDiff;

    return Number(todo2.isImportant) - Number(todo1.isImportant);
};

// Utility function to generate initial tasks
function generateInitialTasks(count: number): ITodo[] {
    const tasks: ITodo[] = [];
    for (let i = 0; i < count; i++) {
        tasks.push({
            id: `task-${i}`,
            title: TASK_TITLES[Math.floor(Math.random() * TASK_TITLES.length)],
            listId: `List ${(i % 5) + 1}`,
            isImportant: Math.random() < 0.3,
            createdDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            dueDate: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000),
        });
    }
    return tasks;
}

// Generic component to render task list
// We deliberaely limit rendering to first 10 items so that DOM does not become a bottleneck
// In real implementations, virtualization libraries like react-window are typically used to limit DOM nodes
function TaskList({ todos }: { todos: ITodo[] }) {
    return (
        <div style={styles.listContainer}>
            {todos.slice(0, 10).map((todo) => (
                <div key={todo.id} style={styles.todoItem}>
                    <div style={styles.todoTitle}>
                        {todo.title}
                        {todo.isImportant && <span style={styles.importantBadge}>⭐</span>}
                    </div>
                    <div style={styles.todoMeta}>
                        Created: {todo.createdDate.toLocaleDateString()} | Due:{" "}
                        {todo.dueDate.toLocaleDateString()}
                    </div>
                </div>
            ))}
        </div>
    );
}

// Memotable based implmentation that sorts upfront and memoizes results
const TodoTable = new Table<string, ITodo>();
TodoTable.sort(ThreeFactorSort);

function MemotableImplementation() {
    useTable(TodoTable);
    return <TaskList todos={Array.from(TodoTable.values())} />;
}

// Map based vanilla implementation
const todos = new Map<string, ITodo>();

function VanillaImplementation() {
    // Filter and sort on every render-pass (how it's typically done in most apps)
    return <TaskList todos={Array.from(todos.values()).sort(ThreeFactorSort)} />;
}

// Generate initial data
const tasks = generateInitialTasks(INITIAL_TASK_COUNT);

// Initialize memotable
TodoTable.batch((t) => {
    tasks.forEach((task) => t.set(task.id, task));
});

// Initialize map for vanilla implementation
tasks.forEach((task) => todos.set(task.id, task));

export function PerfApp() {
    const [activeTab, setActiveTab] = useState<"memotable" | "vanilla">("memotable");
    const [, setRenderKey] = useState(0);

    const forceRerender = useCallback(() => {
        setRenderKey((k) => k + 1);
    }, []);

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Memotable Performance Demo</h1>
                <button onClick={forceRerender} style={styles.forceRenderButton}>
                    Re-render
                </button>
            </div>
            <p style={styles.description}>
                Compare render performance with {INITIAL_TASK_COUNT.toLocaleString()} tasks.
                <br />
                <strong>Instructions:</strong> Click "Re-render" to measure INP values for each
                implementation.
            </p>

            <div style={styles.tabs}>
                <button
                    style={activeTab === "memotable" ? styles.activeTab : styles.tab}
                    onClick={() => setActiveTab("memotable")}
                >
                    Memotable
                </button>
                <button
                    style={activeTab === "vanilla" ? styles.activeTab : styles.tab}
                    onClick={() => setActiveTab("vanilla")}
                >
                    Vanilla
                </button>
            </div>

            <div>
                {activeTab === "memotable" ? (
                    <MemotableImplementation />
                ) : (
                    <VanillaImplementation />
                )}
            </div>
        </div>
    );
}
