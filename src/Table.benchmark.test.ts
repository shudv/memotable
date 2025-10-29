import { Table } from "./Table";

// Type declarations for Node.js test environment
declare const console: {
    log: (...args: any[]) => void;
};

declare const performance: {
    now: () => number;
};

// ============================================================================
// Configuration
// ============================================================================

interface BenchmarkConfig {
    numLists: number;
    tasksPerList: number;
    completionRate: number;
    importantRate: number;
    numEdits: number;
    numReads: number;
}

interface Task {
    id: string;
    listId: string;
    title: string;
    description: string;
    createdAt: number;
    completedAt: number | null;
    isCompleted: boolean;
    isImportant: boolean;
    priority: number;
}

interface BenchmarkResult {
    scenario: string;
    loadTimeMs: number;
    editTimeMs: number;
    readTimeMs: number;
    numEdits: number;
    numReads: number;
}

// Default configuration
const LoadFactor = 1;
const ReadWriteRatio = 5; // Must be greater than 1 to simulate read-heavy workloads
const DEFAULT_CONFIG: BenchmarkConfig = {
    numLists: 50 * LoadFactor,
    tasksPerList: 1000 * LoadFactor,
    completionRate: 0.3,
    importantRate: 0.1,
    numEdits: 100 * LoadFactor,
    numReads: ReadWriteRatio * 100 * LoadFactor,
};

// ============================================================================
// Test Data Generation
// ============================================================================

function generateTasks(config: BenchmarkConfig): Task[] {
    const tasks: Task[] = [];
    const totalTasks = config.numLists * config.tasksPerList;
    const now = Date.now();

    for (let i = 0; i < totalTasks; i++) {
        const listId = `list-${Math.floor(i / config.tasksPerList)}`;
        const isCompleted = Math.random() < config.completionRate;
        const isImportant = Math.random() < config.importantRate;

        tasks.push({
            id: `task-${i}`,
            listId,
            title: `Task ${i}: ${generateRandomTitle()}`,
            description: `Description for task ${i}`,
            createdAt: now - i * 1000, // Older tasks have earlier timestamps
            completedAt: isCompleted ? now - Math.random() * 1000000 : null,
            isCompleted,
            isImportant,
            priority: Math.floor(Math.random() * 5) + 1,
        });
    }

    return tasks;
}

function generateRandomTitle(): string {
    const verbs = ["Fix", "Add", "Update", "Remove", "Refactor", "Implement", "Test"];
    const subjects = ["feature", "bug", "UI", "API", "database", "tests", "documentation"];
    return `${verbs[Math.floor(Math.random() * verbs.length)]} ${subjects[Math.floor(Math.random() * subjects.length)]}`;
}

// ============================================================================
// Scenario 1: Vanilla implementation
// ============================================================================

class VanillaImplementation {
    private tasks: Map<string, Task> = new Map();

    set(id: string, task: Task | null): void {
        if (task === null) {
            this.tasks.delete(id);
        } else {
            this.tasks.set(id, task);
        }
    }

    getListTasks(listId: string): Task[] {
        // Full filter + sort on every read
        return Array.from(this.tasks.values())
            .filter((t) => t.listId === listId && !t.isCompleted)
            .sort((a, b) => {
                // Two-factor sort to match Table implementation
                if (a.isImportant !== b.isImportant) {
                    return a.isImportant ? -1 : 1;
                }
                return b.createdAt - a.createdAt;
            });
    }

    getImportantTasks(): Task[] {
        return Array.from(this.tasks.values())
            .filter((t) => t.isImportant && !t.isCompleted)
            .sort((a, b) => b.createdAt - a.createdAt);
    }
}

// ============================================================================
// Scenario 2: Table-based implementations
// ============================================================================

function setupTableImplementation(): Table<Task> {
    const table = new Table<Task>();

    // Index by list
    table.registerIndex("list", (task) => task.listId);

    // Index by importance (for composite "Important" view)
    table.registerIndex("importance", (task) => (task.isImportant ? "important" : undefined));

    // Global filter + comparator that adapts based on partition path
    table.applyFilter((task, path) => {
        // If in a list partition, filter by listId and not completed
        if (path.length > 2 && path.at(-2) === "list") {
            return task.isCompleted;
        }

        return true; // Default: include all
    });

    // Global comparator that adapts based on partition path
    table.applyComparator((a, b, path) => {
        // If in a list partition, sort by importance + createdAt
        if (path.length > 2 && path.at(-2) === "list") {
            if (a.isImportant !== b.isImportant) {
                return a.isImportant ? -1 : 1;
            }
            return b.createdAt - a.createdAt;
        }

        // Default: sort by createdAt
        return b.createdAt - a.createdAt;
    });

    return table;
}

// ============================================================================
// Edit Patterns
// ============================================================================

function applyEdits(
    tasks: Task[],
    config: BenchmarkConfig,
    setter: (id: string, task: Task) => void,
): void {
    for (let i = 0; i < config.numEdits; i++) {
        const task = tasks[Math.floor(Math.random() * tasks.length)]!;
        const editType = Math.random();

        if (editType < 0.33) {
            // Toggle completion (impacts filters)
            setter(task.id, {
                ...task,
                isCompleted: !task.isCompleted,
                completedAt: !task.isCompleted ? Date.now() : null,
            });
        } else {
            // Toggle importance (impacts sorting)
            setter(task.id, { ...task, isImportant: !task.isImportant });
        }
    }
}

// ============================================================================
// Benchmarking Functions
// ============================================================================

function benchmarkVanilla(tasks: Task[], config: BenchmarkConfig): BenchmarkResult {
    const impl = new VanillaImplementation();

    // Benchmark initial load
    const loadStart = performance.now();
    for (const task of tasks) {
        impl.set(task.id, task);
    }
    const loadEnd = performance.now();

    // Benchmark edits
    const editStart = performance.now();
    applyEdits(tasks, config, (id, task) => impl.set(id, task));
    const editEnd = performance.now();

    const readStart = performance.now();
    for (let i = 0; i < config.numReads; i++) {
        const listId = `list-${Math.floor(Math.random() * config.numLists)}`;
        impl.getListTasks(listId);
        if (i % 10 === 0) {
            impl.getImportantTasks();
        }
    }
    const readEnd = performance.now();

    return {
        scenario: "vanilla",
        loadTimeMs: loadEnd - loadStart,
        editTimeMs: editEnd - editStart,
        readTimeMs: readEnd - readStart,
        numEdits: config.numEdits,
        numReads: config.numReads,
    };
}

function benchmarkMemoTable(tasks: Task[], config: BenchmarkConfig): BenchmarkResult {
    const table = setupTableImplementation();

    // Benchmark initial load
    const loadStart = performance.now();
    table.runBatch(() => {
        for (const task of tasks) {
            table.set(task.id, task);
        }
    });
    const loadEnd = performance.now();

    // Benchmark edits
    const editStart = performance.now();
    applyEdits(tasks, config, (id, task) => table.set(id, task));
    const editEnd = performance.now();

    // Benchmark reads (track total items read)
    const readStart = performance.now();
    for (let i = 0; i < config.numReads; i++) {
        const listId = `list-${Math.floor(Math.random() * config.numLists)}`;
        table.index("list").partition(listId).items();
        if (i % 10 === 0) {
            table.index("importance").partition("important").items();
        }
    }
    const readEnd = performance.now();

    return {
        scenario: "memotable",
        loadTimeMs: loadEnd - loadStart,
        editTimeMs: editEnd - editStart,
        readTimeMs: readEnd - readStart,
        numEdits: config.numEdits,
        numReads: config.numReads,
    };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Table - Performance Benchmarks", () => {
    let config: BenchmarkConfig;
    let tasks: Task[];

    beforeAll(() => {
        config = DEFAULT_CONFIG;
        console.log("\n📊 Benchmark Configuration:");
        console.log(`  Lists: ${config.numLists}`);
        console.log(`  Tasks per list: ${config.tasksPerList}`);
        console.log(`  Total tasks: ${config.numLists * config.tasksPerList}`);
        console.log(`  Completion rate: ${(config.completionRate * 100).toFixed(0)}%`);
        console.log(`  Important rate: ${(config.importantRate * 100).toFixed(0)}%`);
        console.log(`  Edit operations: ${config.numEdits}`);
        console.log(`  Read operations: ${config.numReads}\n`);

        tasks = generateTasks(config);
    });

    test("memotable vs vanilla performance comparison", () => {
        const vanillaResult = benchmarkVanilla([...tasks], config);
        const tableResult = benchmarkMemoTable([...tasks], config);

        // Basic sanity checks
        expect(vanillaResult.loadTimeMs).toBeGreaterThan(0);
        expect(vanillaResult.editTimeMs).toBeGreaterThan(0);
        expect(vanillaResult.readTimeMs).toBeGreaterThan(0);
        expect(tableResult.loadTimeMs).toBeGreaterThan(0);
        expect(tableResult.editTimeMs).toBeGreaterThan(0);
        expect(tableResult.readTimeMs).toBeGreaterThan(0);

        // Performance assertions
        const readSpeedup = vanillaResult.readTimeMs / tableResult.readTimeMs;
        const vanillaTotal =
            vanillaResult.loadTimeMs + vanillaResult.editTimeMs + vanillaResult.readTimeMs;
        const tableTotal = tableResult.loadTimeMs + tableResult.editTimeMs + tableResult.readTimeMs;
        const totalSpeedup = vanillaTotal / tableTotal;

        // memotable reads should be faster than vanilla
        expect(tableResult.readTimeMs).toBeLessThan(vanillaResult.readTimeMs);

        // memotable overall should be faster than vanilla (for read-heavy workloads)
        expect(tableTotal).toBeLessThan(vanillaTotal);

        // Display comparison table
        const numTasksLoaded = config.numLists * config.tasksPerList;
        const COL_WIDTH = 20;
        const TABLE_WIDTH = COL_WIDTH * 5;

        console.log("=".repeat(TABLE_WIDTH));
        console.log("📈 PERFORMANCE COMPARISON");
        console.log("=".repeat(TABLE_WIDTH) + "\n");

        const vanillaEditPerOp = vanillaResult.editTimeMs / vanillaResult.numEdits;
        const tableEditPerOp = tableResult.editTimeMs / tableResult.numEdits;

        // Display results with dynamic column widths
        console.log(
            [
                "Scenario",
                `Load(${numTasksLoaded})`,
                `Edit(${config.numEdits})`,
                `Read(${config.numReads})`,
                "Total",
            ]
                .map((h) => h.padEnd(COL_WIDTH))
                .join(""),
        );
        console.log("-".repeat(TABLE_WIDTH));
        console.log(
            [
                "vanilla",
                `${vanillaResult.loadTimeMs.toFixed(1)}ms`,
                `${vanillaResult.editTimeMs.toFixed(1)}ms`,
                `${vanillaResult.readTimeMs.toFixed(1)}ms`,
                `${vanillaTotal.toFixed(1)}ms`,
            ]
                .map((c) => c.padEnd(COL_WIDTH))
                .join(""),
        );
        console.log(
            [
                "memotable",
                `${tableResult.loadTimeMs.toFixed(1)}ms`,
                `${tableResult.editTimeMs.toFixed(1)}ms`,
                `${tableResult.readTimeMs.toFixed(1)}ms`,
                `${tableTotal.toFixed(1)}ms`,
            ]
                .map((c) => c.padEnd(COL_WIDTH))
                .join(""),
        );

        console.log("\n" + "=".repeat(TABLE_WIDTH));

        // Key insights
        const ERROR_MARGIN = 0.1; // 10% margin for "similar" performance
        const loadSlowdown = tableResult.loadTimeMs / vanillaResult.loadTimeMs;
        const editSlowdown = tableEditPerOp / vanillaEditPerOp;
        const readWriteRatio = config.numReads / config.numEdits;

        console.log("\n💡 Key Insights:");
        console.log(
            `  • memotable is ${loadSlowdown.toFixed(1)}x slower for initial load (${vanillaResult.loadTimeMs.toFixed(1)}ms vs ${tableResult.loadTimeMs.toFixed(1)}ms)`,
        );
        console.log(
            `  • memotable is ${readSpeedup.toFixed(1)}x faster for reads but ${editSlowdown.toFixed(1)}x slower for edits`,
        );

        // Overall performance comparison with error margin
        if (Math.abs(totalSpeedup - 1.0) <= ERROR_MARGIN) {
            console.log(
                `  • Overall: memotable performs similar to vanilla for read/write ratio of ${readWriteRatio.toFixed(1)} (${vanillaTotal.toFixed(1)}ms vs ${tableTotal.toFixed(1)}ms)`,
            );
        } else {
            console.log(
                `  • Overall: memotable is ${totalSpeedup.toFixed(1)}x ${totalSpeedup > 1 ? "faster" : "slower"} for read/write ratio of ${readWriteRatio.toFixed(1)} (${vanillaTotal.toFixed(1)}ms vs ${tableTotal.toFixed(1)}ms)`,
            );
        }

        console.log("\n" + "=".repeat(TABLE_WIDTH) + "\n");
    });
});
