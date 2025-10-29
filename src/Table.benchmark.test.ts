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
    editTimeMs: number;
    readTimeMs: number;
    numEdits: number;
    numReads: number;
    totalItemsRead: number; // Total items returned across all reads
}

// Default configuration
const DEFAULT_CONFIG: BenchmarkConfig = {
    numLists: 50,
    tasksPerList: 1000,
    completionRate: 0.3,
    importantRate: 0.1,
    numEdits: 100,
    numReads: 500,
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

class PlainImplementation {
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
// Scenario 2 & 3: Table-based implementations
// ============================================================================

function setupTableImplementation(materialize: boolean): Table<Task> {
    const table = new Table<Task>({
        name: "Tasks",
        deltaTracking: true,
        shouldMaterialize: materialize ? (_, isTerminal) => isTerminal : () => false,
    });

    // Index by list
    table.registerIndex("list", (task) => task.listId);

    // Index by importance (for composite "Important" view)
    table.registerIndex("importance", (task) => (task.isImportant ? "important" : "normal"));

    return table;
}

// Cache for configured partitions (simulates what a real app would do)
const partitionCache = new Map<string, any>();

function getConfiguredListPartition(table: Table<Task>, listId: string) {
    const cacheKey = `list:${listId}`;
    if (!partitionCache.has(cacheKey)) {
        const partition = table.index("list").partition(listId);
        partition.applyFilter((task) => !task.isCompleted);
        partition.applyComparator((a, b) => {
            if (a.isImportant !== b.isImportant) {
                return a.isImportant ? -1 : 1;
            }
            return b.createdAt - a.createdAt;
        });
        partitionCache.set(cacheKey, partition);
    }
    return partitionCache.get(cacheKey);
}

function getConfiguredImportantPartition(table: Table<Task>) {
    const cacheKey = "important";
    if (!partitionCache.has(cacheKey)) {
        const partition = table.index("importance").partition("important");
        partition.applyFilter((task) => !task.isCompleted);
        partition.applyComparator((a, b) => b.createdAt - a.createdAt);
        partitionCache.set(cacheKey, partition);
    }
    return partitionCache.get(cacheKey);
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
            // Toggle completion
            setter(task.id, {
                ...task,
                isCompleted: !task.isCompleted,
                completedAt: !task.isCompleted ? Date.now() : null,
            });
        } else if (editType < 0.66) {
            // Change priority
            setter(task.id, { ...task, priority: Math.floor(Math.random() * 5) + 1 });
        } else {
            // Toggle importance
            setter(task.id, { ...task, isImportant: !task.isImportant });
        }
    }
}

// ============================================================================
// Benchmarking Functions
// ============================================================================

function benchmarkPlain(tasks: Task[], config: BenchmarkConfig): BenchmarkResult {
    const impl = new PlainImplementation();

    // Load data
    for (const task of tasks) {
        impl.set(task.id, task);
    }

    // Benchmark edits
    const editStart = performance.now();
    applyEdits(tasks, config, (id, task) => impl.set(id, task));
    const editEnd = performance.now();

    // Benchmark reads (track total items read)
    let totalItemsRead = 0;
    const readStart = performance.now();
    for (let i = 0; i < config.numReads; i++) {
        const listId = `list-${Math.floor(Math.random() * config.numLists)}`;
        const items = impl.getListTasks(listId);
        totalItemsRead += items.length;
        if (i % 10 === 0) {
            const important = impl.getImportantTasks();
            totalItemsRead += important.length;
        }
    }
    const readEnd = performance.now();

    return {
        scenario: "vanilla",
        editTimeMs: editEnd - editStart,
        readTimeMs: readEnd - readStart,
        numEdits: config.numEdits,
        numReads: config.numReads,
        totalItemsRead,
    };
}

function benchmarkTable(
    tasks: Task[],
    config: BenchmarkConfig,
    materialize: boolean,
): BenchmarkResult {
    // Clear partition cache between runs
    partitionCache.clear();

    const table = setupTableImplementation(materialize);

    // Load data
    table.runBatch(() => {
        for (const task of tasks) {
            table.set(task.id, task);
        }
    });

    // Pre-warm partitions (simulates app startup where views are created once)
    for (let i = 0; i < config.numLists; i++) {
        getConfiguredListPartition(table, `list-${i}`);
    }
    getConfiguredImportantPartition(table);

    // Benchmark edits
    const editStart = performance.now();
    applyEdits(tasks, config, (id, task) => table.set(id, task));
    const editEnd = performance.now();

    // Benchmark reads (track total items read)
    let totalItemsRead = 0;
    const readStart = performance.now();
    for (let i = 0; i < config.numReads; i++) {
        const listId = `list-${Math.floor(Math.random() * config.numLists)}`;
        const items = getConfiguredListPartition(table, listId).items();
        totalItemsRead += items.length;
        if (i % 10 === 0) {
            const important = getConfiguredImportantPartition(table).items();
            totalItemsRead += important.length;
        }
    }
    const readEnd = performance.now();

    return {
        scenario: materialize ? "memotable" : "memotable (no cache)",
        editTimeMs: editEnd - editStart,
        readTimeMs: readEnd - readStart,
        numEdits: config.numEdits,
        numReads: config.numReads,
        totalItemsRead,
    };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Table - Performance Benchmarks", () => {
    let config: BenchmarkConfig;
    let tasks: Task[];
    let vanillaResult: BenchmarkResult;
    let tableResult: BenchmarkResult;

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

    test("vainlla", () => {
        vanillaResult = benchmarkPlain([...tasks], config);

        console.log(
            `✓ ${vanillaResult.scenario}: Edit ${vanillaResult.editTimeMs.toFixed(1)}ms, Read ${vanillaResult.readTimeMs.toFixed(1)}ms`,
        );
        expect(vanillaResult.editTimeMs).toBeGreaterThan(0);
        expect(vanillaResult.readTimeMs).toBeGreaterThan(0);
    });

    test("memotable", () => {
        tableResult = benchmarkTable([...tasks], config, true);

        console.log(
            `✓ ${tableResult.scenario}: Edit ${tableResult.editTimeMs.toFixed(1)}ms, Read ${tableResult.readTimeMs.toFixed(1)}ms\n`,
        );
        expect(tableResult.editTimeMs).toBeGreaterThan(0);
        expect(tableResult.readTimeMs).toBeGreaterThan(0);
    });

    afterAll(() => {
        if (!vanillaResult || !tableResult) return;

        console.log("=".repeat(70));
        console.log("📈 PERFORMANCE COMPARISON");
        console.log("=".repeat(70) + "\n");

        // Calculate per-item metrics
        const vanillaReadPerItem = vanillaResult.readTimeMs / vanillaResult.totalItemsRead;
        const tableReadPerItem = tableResult.readTimeMs / tableResult.totalItemsRead;

        const vanillaEditPerOp = vanillaResult.editTimeMs / vanillaResult.numEdits;
        const tableEditPerOp = tableResult.editTimeMs / tableResult.numEdits;

        const vanillaTotal = vanillaResult.editTimeMs + vanillaResult.readTimeMs;
        const tableTotal = tableResult.editTimeMs + tableResult.readTimeMs;

        // Display results
        console.log("Scenario          Edit              Read              Total");
        console.log("-".repeat(70));
        console.log(
            [
                "vanilla",
                `${vanillaResult.editTimeMs.toFixed(1)}ms`,
                `${vanillaResult.readTimeMs.toFixed(1)}ms`,
                `${vanillaTotal.toFixed(1)}ms`,
            ]
                .map((c) => c.padEnd(18))
                .join(""),
        );
        console.log(
            [
                "memotable",
                `${tableResult.editTimeMs.toFixed(1)}ms`,
                `${tableResult.readTimeMs.toFixed(1)}ms`,
                `${tableTotal.toFixed(1)}ms`,
            ]
                .map((c) => c.padEnd(18))
                .join(""),
        );

        console.log("\n" + "=".repeat(70));

        // Key insights
        const readSpeedup = vanillaReadPerItem / tableReadPerItem;
        const editSlowdown = tableEditPerOp / vanillaEditPerOp;
        const totalSpeedup = vanillaTotal / tableTotal;
        const readWriteRatio = config.numReads / config.numEdits;

        console.log("\n💡 Key Insights:");
        console.log(
            `  • Table is ${readSpeedup.toFixed(1)}x faster for reads but ${editSlowdown.toFixed(1)}x slower for edits (as compared to Vanilla)`,
        );
        console.log(
            `  • Overall: Table is ${totalSpeedup.toFixed(1)}x ${totalSpeedup > 1 ? "faster" : "slower"} for read/write ratio of ${readWriteRatio.toFixed(1)} (${vanillaTotal.toFixed(1)}ms vs ${tableTotal.toFixed(1)}ms)`,
        );

        console.log("\n" + "=".repeat(70) + "\n");
    });
});
