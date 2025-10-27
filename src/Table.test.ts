// Table
import { Table } from './Table';

interface ITask {
    title: string;
    planId?: string;
    priority?: number;
    tags?: string[];
    description?: string;
    isCompleted?: boolean;
}

describe('Table - Unit Tests', () => {
    let table: Table<ITask>;

    beforeEach(() => {
        table = new Table<ITask>();
    });

    describe('Basic operations', () => {
        test('set and get', () => {
            table.set('1', { title: 'Task One' });
            table.set('2', { title: 'Task Two' });
            table.set('3', { title: 'Task Three' });

            expect(table.get('1')?.title).toEqual('Task One');
            expect(table.itemIds()).toEqual(['1', '2', '3']);
            expect(table.items().length).toEqual(3);
        });

        test('set and get - custom equality', () => {
            table = new Table<ITask>({ isEqual: (task1, task2) => task1.title === task2.title });
            const task = { title: 'Task One' };
            expect(table.set('1', task)).toBe(true);
            expect(table.set('1', task)).toBe(false); // No-op
            expect(table.set('1', task)).toBe(false); // No-op

            expect(table.get('1')?.title).toEqual(task.title);
            table.set('1', {
                title: 'Task One Updated',
            });
            expect(table.get('1')?.title).toEqual('Task One Updated');

            table.set('1', null); // Should remove the item
            expect(table.get('1')).toBeNull();
        });

        test('delete', () => {
            table.set('1', { title: 'Task One' });
            expect(table.delete('1')).toBe(true);
            expect(table.delete('1')).toBe(false); // No-op
            expect(table.delete('1')).toBe(false); // No-op

            expect(table.get('1')).toBeNull();
        });

        test('runBatch', () => {
            table = new Table<ITask>({ isEqual: (task1, task2) => task1.title === task2.title });

            let changed = table.runBatch((t) => {
                t.set('1', { title: 'Task One*' });
                t.set('2', { title: 'Task Two*' });
                t.delete('3');
                t.set('4', { title: 'Task Four*' });
            });

            expect(changed).toBe(true);
            expect(table.get('1')!.title).toEqual('Task One*');
            expect(table.get('2')!.title).toEqual('Task Two*');
            expect(table.get('3')).toBeNull();
            expect(table.get('4')!.title).toEqual('Task Four*');

            // Duplicate execution should not change the table
            changed = table.runBatch((t) => {
                t.set('1', { title: 'Task One*' });
                t.set('2', { title: 'Task Two*' });
                t.delete('3');
                t.set('4', { title: 'Task Four*' });
            });
            expect(changed).toBe(false);
        });

        test('refresh', () => {
            table.set('1', { title: 'Task One', priority: 1 });
            table.set('2', { title: 'Task Two', priority: 2 });
            table.set('3', { title: 'Task Three', priority: 3 });
            table.set('4', { title: 'Task Four', priority: 4 });

            // Apply a filter that uses an array external to the table to determine inclusion
            const titlesToInclude: string[] = [];
            table.applyFilter((item) => titlesToInclude.includes(item.title!));

            // No items should be included initially
            expect(table.itemIds()).toEqual([]);

            // Add titles to include and refresh items
            titlesToInclude.push('Task One', 'Task Four');

            // Because the filter was updated externally, still no item would be included
            expect(table.itemIds()).toEqual([]);

            // Refresh items to re-evaluate the filter
            table.refresh('1');

            // Only the refreshed item should be included if it meets the filter criteria
            expect(table.itemIds()).toEqual(['1']);

            table.refresh('2');
            table.refresh('3');
            table.refresh('4');
            expect(table.itemIds()).toEqual(['1', '4']);
        });
    });

    describe('View', () => {
        beforeEach(() => {
            table.set('1', { title: 'Short', priority: 3 });
            table.set('2', { title: 'A bit longer' });
            table.set('3', { title: 'This is a very long title indeed', priority: 0 });
            table.set('4', { title: 'Medium length', priority: 2 });
        });

        test('empty table - should be no-op', () => {
            const table = new Table<ITask>();

            expect(table.items().length).toBe(0);

            table.applyFilter((item) => (item.priority ?? 0) >= 2);
            table.applyComparator((a, b) => (a.title.length > b.title.length ? 1 : -1));

            expect(table.items().length).toBe(0);
        });

        test('Filtering', () => {
            // Apply a filter to the table
            table.applyFilter((item) => (item.priority ?? 0) >= 2);

            // View should honour the comparator and filter
            expectEqualUnordered(table.itemIds(), ['1', '4']);

            // Apply a new filter that is more lenient
            table.applyFilter((item) => item.priority !== undefined);
            expectEqualUnordered(table.itemIds(), ['1', '3', '4']);

            // Make table updates
            table.set('4', { title: 'M' });
            table.set('5', { title: 'New Task', priority: 1 });

            // The view should reflect the update
            expectEqualUnordered(table.itemIds(), ['1', '3', '5']);

            // Remove the filter
            table.applyFilter(null);
            expectEqualUnordered(table.itemIds(), ['1', '2', '3', '4', '5']);
        });

        test('Ordering', () => {
            // Table should be ordered by title length
            table.applyComparator((a, b) => (a.title.length > b.title.length ? 1 : -1));

            // The view should reflect the ordering
            expect(table.itemIds()).toEqual(['1', '2', '4', '3']);

            // Apply a new comparator that sorts by title alphabetically
            table.applyComparator((a, b) => a.title.localeCompare(b.title));
            expect(table.itemIds()).toEqual(['2', '4', '1', '3']);

            // Make table updates
            table.set('4', { title: 'Z' });
            table.set('5', { title: 'New Task', priority: 1 });
            table.set('6', { title: 'A Task', priority: 1 });

            expect(table.itemIds()).toEqual(['2', '6', '5', '1', '3', '4']);

            // Remove the comparator
            table.applyComparator(null);
            expectEqualUnordered(table.itemIds(), ['1', '2', '3', '4', '5', '6']);
        });

        test('Combined filter and ordering', () => {
            table.applyFilter((item) => (item.priority ?? 0) >= 2);
            table.applyComparator((a, b) => a.title.localeCompare(b.title));

            // The table should be filtered and ordered
            expect(table.itemIds()).toEqual(['4', '1']);

            // Make table updates
            table.set('4', { title: 'M' });
            table.set('5', { title: 'ZZZZZ', priority: 3 });

            // The table should reflect the update
            expect(table.itemIds()).toEqual(['1', '5']);

            // Apply a new filter that allows all items
            table.applyFilter((_) => true);
            expect(table.itemIds()).toEqual(['2', '4', '1', '3', '5']);
        });

        test('Filter/Sort at parent node - with index/partition specific behavior', () => {
            table.registerIndex('planView', () => 'planView');
            const viewPartition = table.index('planView').partition('planView');

            viewPartition.registerIndex('A', (item) => item.planId);
            viewPartition.registerIndex('A-Inverse', (item) => item.planId);
            const viewFilter = (task: ITask, path: string[]) => {
                const index = path.at(-2);
                const planId = path.at(-1);
                switch (planId) {
                    case 'p1':
                    case 'p2':
                        return index === 'A'
                            ? task.title!.endsWith(planId)
                            : !task.title!.endsWith(planId);
                    case 'p3':
                        return index === 'A' ? task.title!.length === 1 : task.title!.length !== 1;
                    default:
                        return true;
                }
            };
            const viewComparator = (task1: ITask, task2: ITask, path: string[]) => {
                const index = path.at(-2);
                const planId = path.at(-1);
                switch (planId) {
                    case 'p1':
                        return index === 'A'
                            ? task1.title!.localeCompare(task2.title!)
                            : task2.title!.localeCompare(task1.title!);
                    case 'p2':
                        return index === 'A'
                            ? task2.title!.localeCompare(task1.title!)
                            : task1.title!.localeCompare(task2.title!);
                    case 'p3':
                    default:
                        return 0; // No specific sorting for p3
                }
            };

            viewPartition.applyFilter(viewFilter);
            viewPartition.applyComparator(viewComparator);

            table.set('1', { planId: 'p1', title: 'A - p1' });
            table.set('2', { planId: 'p1', title: 'B - p1' });
            table.set('3', { planId: 'p1', title: 'C' }); // Does not meet filter criteria for p1

            table.set('4', { planId: 'p2', title: 'D - p2' });
            table.set('5', { planId: 'p2', title: 'E' }); // Does not meet filter criteria for p2
            table.set('6', { planId: 'p2', title: 'F - p2' });

            table.set('7', { planId: 'p3', title: 'J' });
            table.set('8', { planId: 'p3', title: 'H' });
            table.set('9', { planId: 'p3', title: 'I' });
            table.set('10', { planId: 'p3', title: 'G1' });
            table.set('11', { planId: 'p3', title: 'K' });

            const plan1ViewPartitionA = viewPartition.index('A').partition('p1');
            const plan2ViewPartitionA = viewPartition.index('A').partition('p2');
            const plan3ViewPartitionA = viewPartition.index('A').partition('p3');
            const plan1ViewPartitionAInverse = viewPartition.index('A-Inverse').partition('p1');
            const plan2ViewPartitionAInverse = viewPartition.index('A-Inverse').partition('p2');
            const plan3ViewPartitionAInverse = viewPartition.index('A-Inverse').partition('p3');

            expect(plan1ViewPartitionA.itemIds()).toEqual(['1', '2']); // Filtered and sorted by title ascending
            expect(plan2ViewPartitionA.itemIds()).toEqual(['6', '4']); // Filtered and sorted by title descending
            expectEqualUnordered(plan3ViewPartitionA.itemIds(), ['7', '8', '9', '10', '11']); // No filter sort applied

            // Assert Inverse filter and sort applied on A Inverse
            expect(plan1ViewPartitionAInverse.itemIds()).toEqual(['3']);
            expect(plan2ViewPartitionAInverse.itemIds()).toEqual(['5']);
            expectEqualUnordered(plan3ViewPartitionAInverse.itemIds(), []);

            // Apply a filter comparator at table level
            table.applyFilter((task) => task.title!.length === 1);
            table.applyComparator((a, b) => a.title!.localeCompare(b.title!));

            // All partitions should reflect the table level filter and sort
            expect(plan1ViewPartitionA.itemIds()).toEqual(['3']);
            expect(plan2ViewPartitionA.itemIds()).toEqual(['5']);
            expect(plan3ViewPartitionA.itemIds()).toEqual(['8', '9', '7', '11']);
            expect(plan1ViewPartitionAInverse.itemIds()).toEqual(['3']);
            expect(plan2ViewPartitionAInverse.itemIds()).toEqual(['5']);
            expect(plan3ViewPartitionAInverse.itemIds()).toEqual(['8', '9', '7', '11']);
        });

        test('applyFilter > registerIndex > removeFilter', () => {
            table = new Table<ITask>();

            table.set('1', { title: 'Task One', priority: 1 });
            table.set('2', { title: 'Task Two', priority: 0 });
            table.set('3', { title: 'Task Three', priority: 2 });
            table.set('4', { title: 'Task Four' });

            // Apply a filter to the table which does not have any index yet
            table.applyFilter((item) => (item.priority ?? 0) >= 1);

            // Now register an index
            table.registerIndex('title', (item) => item.title);

            // New index partitions should honor the applied filter
            const index = table.index('title');
            expect(index.partition('Task One').itemIds()).toEqual(['1']);
            expect(index.partition('Task Two').itemIds()).toEqual([]);
            expect(index.partition('Task Three').itemIds()).toEqual(['3']);
            expect(index.partition('Task Four').itemIds()).toEqual([]);

            // Now remove the filter
            table.applyFilter(null);

            // The index partitions should reflect the removal of the filter
            expect(index.partition('Task One').itemIds()).toEqual(['1']);
            expect(index.partition('Task Two').itemIds()).toEqual(['2']);
            expect(index.partition('Task Three').itemIds()).toEqual(['3']);
            expect(index.partition('Task Four').itemIds()).toEqual(['4']);
        });

        test('refreshView', () => {
            const viewConfig = { minPriority: 2, sortByPriorityAsc: true };

            table.applyFilter(
                (item) => item.priority !== undefined && item.priority >= viewConfig.minPriority
            );
            table.applyComparator((a, b) => {
                if (viewConfig.sortByPriorityAsc) {
                    return (a.priority ?? 0) - (b.priority ?? 0);
                }
                return (b.priority ?? 0) - (a.priority ?? 0);
            });

            expect(table.itemIds()).toEqual(['4', '1']);

            // Change view config
            viewConfig.minPriority = 0;
            viewConfig.sortByPriorityAsc = false;

            // Because the filter and comparator were updated externally, still no change in view
            expect(table.itemIds()).toEqual(['4', '1']);

            // Refresh the view to re-evaluate filter and comparator
            table.refreshView();

            expect(table.itemIds()).toEqual(['1', '4', '3']);
        });
    });

    describe('Indexing', () => {
        beforeEach(() => {
            table = new Table<ITask>();
            table.registerIndex('title', (item) => item.title);
            table.registerIndex('plan', (item) => item.planId ?? 'default');
            table.registerIndex('priority', (item) =>
                item.priority ? item.priority.toString() : null
            );
            table.registerIndex('tags', (item) => item.tags ?? null);
            table.registerIndex('description', (item) =>
                (item.description ?? '').length > 2 ? 'HasDescription' : null
            );
            table.registerIndex('isCompleted', (item) =>
                item.isCompleted ? 'completed' : 'pending'
            );
        });

        test('Correctness for basic unsorted unfiltered indexes', () => {
            // Add a record
            let record: ITask = {
                title: 'Important Task',
                priority: 1,
                tags: ['urgent', 'feature'],
                description: 'This is a detailed description',
                isCompleted: true,
            };
            table.set('1', record);

            expect(table.index('title').partition('Important Task').itemIds()).toEqual(['1']);
            expect(table.index('priority').partition('1').itemIds()).toEqual(['1']);
            expect(table.index('tags').partition('urgent').itemIds()).toEqual(['1']);
            expect(table.index('tags').partition('feature').itemIds()).toEqual(['1']);
            expect(table.index('description').partition('HasDescription').itemIds()).toEqual(['1']);
            expect(table.index('isCompleted').partition('completed').itemIds()).toEqual(['1']);

            // Apply an update
            record = {
                title: 'Updated Task',
                priority: 2,
                tags: ['urgent', 'bugfix'],
                description: 'Updated detailed description',
                isCompleted: false,
            };
            table.set('1', record);

            expect(table.index('title').partition('Important Task').itemIds()).toEqual([]);
            expect(table.index('title').partition('Updated Task').itemIds()).toEqual(['1']);
            expect(table.index('priority').partition('1').itemIds()).toEqual([]);
            expect(table.index('priority').partition('2').itemIds()).toEqual(['1']);
            expect(table.index('tags').partition('urgent').itemIds()).toEqual(['1']);
            expect(table.index('tags').partition('feature').itemIds()).toEqual([]);
            expect(table.index('tags').partition('bugfix').itemIds()).toEqual(['1']);
            expect(table.index('description').partition('HasDescription').itemIds()).toEqual(['1']);
            expect(table.index('isCompleted').partition('completed').itemIds()).toEqual([]);
            expect(table.index('isCompleted').partition('pending').itemIds()).toEqual(['1']);

            // Delete the record
            table.delete('1');
            expect(table.index('title').partition('Updated Task').itemIds()).toEqual([]);
            expect(table.index('priority').partition('2').itemIds()).toEqual([]);
            expect(table.index('tags').partition('urgent').itemIds()).toEqual([]);
            expect(table.index('tags').partition('bugfix').itemIds()).toEqual([]);
            expect(table.index('description').partition('HasDescription').itemIds()).toEqual([]);
            expect(table.index('isCompleted').partition('pending').itemIds()).toEqual([]);
        });

        test('Order stability for unsorted indexes', () => {
            // Add multiple records
            table.set('1', { title: 'T1', planId: 'p1' });
            table.set('2', { title: 'T2', planId: 'p1' });
            table.set('3', { title: 'T3', planId: 'p1' });
            table.set('4', { title: 'W1', planId: 'p1' });

            const p1 = table.index('plan').partition('p1');
            // Application of filter should not affect order
            p1.applyFilter((item) => item.title.startsWith('T'));

            const viewIdsOriginalOrder = p1.itemIds();
            expectEqualUnordered(viewIdsOriginalOrder, ['1', '2', '3']);

            // Updates should not change order of unsorted indexes
            table.set('2', { planId: 'p1', title: 'T2 Updated' });
            table.set('3', { planId: 'p1', title: 'T3 Updated' });
            expect(p1.itemIds()).toEqual(viewIdsOriginalOrder);
        });

        test('registerIndex', () => {
            table.set('1', { title: 'Task One', priority: 1 });

            expect(table.registerIndex('priority1', (item) => `${item.priority?.toString()}`)).toBe(
                true
            );
            const index = table.index('priority1');

            // should create on registration
            expect(index.partition('1').itemIds()).toEqual(['1']);

            // try re-register same index with a different definition
            expect(table.registerIndex('priority1', (item) => `${item.priority?.toString()}`)).toBe(
                false
            );
            const index2 = table.index('priority1');

            // The new definition should be ignored and existing index should remain unchanged
            expect(index2).toBe(index); // Should return the same index
            expect(index2.partition('1').itemIds()).toEqual(['1']); // previous definition
            expect(index2.partition('1*').itemIds()).toEqual([]); // new definition should not take effect
        });

        test('registerIndex - readonly keys', () => {
            table.set('1', { title: 'Task One', priority: 1 });
            table.registerIndex('priority1', (item) =>
                Object.freeze([`${item.priority?.toString()}`])
            );
            const index = table.index('priority1');

            // Should create on registration
            expect(index.partition('1').itemIds()).toEqual(['1']);
        });

        test('registerIndex with invalid name', () => {
            expect(() =>
                table.registerIndex('invalid/////name', (item) => `${item.priority?.toString()}`)
            ).toThrow();
        });

        test('registerIndex with invalid partition keys', () => {
            table.registerIndex('test', (item) => item.title);

            expect(() => table.set('1', { title: 'Task////One' })).toThrow();
        });

        test('refreshIndex - non-existent index', () => {
            expect(() => table.refreshIndex('does-not-exist')).toThrow();
        });

        test('refreshIndex - existing index', () => {
            const indexConfig = { priorityCutOff: 1 };

            // An index that references an external config to determine partitioning
            table.registerIndex('custom', (item) =>
                item.priority && item.priority > indexConfig.priorityCutOff ? 'high' : 'low'
            );

            table.set('1', { title: 'Task One', priority: 1 });
            table.set('2', { title: 'Task Two', priority: 2 });
            table.set('3', { title: 'Task Three', priority: 3 });
            table.set('4', { title: 'Task Four', priority: 4 });
            expect(table.index('custom').partition('low').itemIds()).toEqual(['1']);
            expect(table.index('custom').partition('high').itemIds()).toEqual(['2', '3', '4']);

            // Change index config so that partitioning logic changes
            indexConfig.priorityCutOff = 3;

            // Partitions should still reflect old logic
            expect(table.index('custom').partition('low').itemIds()).toEqual(['1']);
            expect(table.index('custom').partition('high').itemIds()).toEqual(['2', '3', '4']);

            table.refreshIndex('custom');

            // Partitions should now reflect the new logic
            expect(table.index('custom').partition('low').itemIds()).toEqual(['1', '2', '3']);
            expect(table.index('custom').partition('high').itemIds()).toEqual(['4']);
        });

        test('dropIndex', () => {
            table.set('1', { title: 'Task One', priority: 1 });
            expect(table.index('title').keys().length).toBeGreaterThan(0);

            expect(table.dropIndex('title')).toBe(true); // Should drop index and return true
            expect(table.dropIndex('title')).toBe(false); // No-op, should return false as nothing changed
        });

        test('Index partition keys', () => {
            table.set('1', {
                title: 'Important Task',
                priority: 1,
                tags: ['urgent', 'feature'],
                description: 'D1',
                isCompleted: true,
            });
            table.set('2', {
                title: 'Customer request',
                priority: 2,
                tags: ['feature', 'backlog'],
                description: 'D2',
                isCompleted: true,
            });

            expect(table.index('title').keys()).toStrictEqual([
                'Important Task',
                'Customer request',
            ]);
            expect(table.index('priority').keys()).toStrictEqual(['1', '2']);
            expect(table.index('tags').keys()).toStrictEqual(['urgent', 'feature', 'backlog']);
        });

        test('Non-existent index', () => {
            const invalidIndex = table.index('does-not-exist-yet');

            expect(invalidIndex.keys().length).toBe(0);
            expect(invalidIndex.partition('any').itemIds().length).toBe(0);

            // Should still allow registering index with the name if needed later
            table.registerIndex('does-not-exist-yet', (item) => item.title);
            table.set('1', { title: 'Task One' });
            expect(table.index('does-not-exist-yet').keys().length).toBeGreaterThan(0);
        });
    });

    describe('Recursive partitioning', () => {
        beforeEach(() => {
            // Add items with different plans, priorities, and completion status
            table.set('1', {
                title: 'Alice Task',
                planId: 'plan1',
                priority: 5,
                isCompleted: false,
            });
            table.set('2', { title: 'Bob Work', planId: 'plan1', priority: 3, isCompleted: true });
            table.set('3', {
                title: 'Charlie Item',
                planId: 'plan1',
                priority: 8,
                isCompleted: false,
            });
            table.set('4', {
                title: 'David Task',
                planId: 'plan1',
                priority: 1,
                isCompleted: true,
            });
            table.set('5', { title: 'Eve Work', planId: 'plan1', priority: 7, isCompleted: true });
            table.set('6', {
                title: 'Frank Item',
                planId: 'plan2',
                priority: 4,
                isCompleted: true,
            });
            table.set('7', {
                title: 'Grace Task',
                planId: 'plan2',
                priority: 6,
                isCompleted: false,
            });
            table.set('8', {
                title: 'Henry Work',
                planId: 'plan3',
                priority: 2,
                isCompleted: true,
            });
        });

        test('should allow defining sub-partitions recursively', () => {
            // Create plan index to partition by plan
            table.registerIndex('plan', (task) => task.planId ?? 'default');
            const planIndex = table.index('plan');
            const plan1Partition = planIndex.partition('plan1');
            expectEqualUnordered(plan1Partition.itemIds(), ['1', '2', '3', '4', '5']);

            // Create a sub-partition for high priority tasks
            plan1Partition.registerIndex('highPriority', (task) =>
                (task.priority ?? 0) >= 5 ? 'high' : 'low'
            );
            const highPriorityIndex = plan1Partition.index('highPriority');
            const highPriorityPartition = highPriorityIndex.partition('high');
            expectEqualUnordered(highPriorityPartition.itemIds(), ['1', '3', '5']);

            // Create a sub-partition for completed tasks
            highPriorityPartition.registerIndex('completed', (task) =>
                task.isCompleted ? 'completed' : 'pending'
            );
            const completedIndex = highPriorityPartition.index('completed');
            const completedPartition = completedIndex.partition('completed');
            expectEqualUnordered(completedPartition.itemIds(), ['5']);
        });

        test('applying a filter/comparator at a partition should apply recursively to all sub-partitions', () => {
            // Create plan index to partition by plan
            table.registerIndex('plan', (task) => task.planId ?? 'default');
            const planIndex = table.index('plan');
            const plan1Partition = planIndex.partition('plan1');

            // Create two identical partitions for supporting different views
            plan1Partition.registerIndex('view', (_) => ['grid', 'board']);
            const plan1ViewIndex = plan1Partition.index('view');
            const plan1GridPartition = plan1ViewIndex.partition('grid');
            const plan1BoardPartition = plan1ViewIndex.partition('board');

            // Create a status partition on the board view
            plan1BoardPartition.registerIndex('status', (task) =>
                task.isCompleted ? 'completed' : 'pending'
            );
            const plan1BoardStatusIndex = plan1BoardPartition.index('status');
            const plan1BoardCompletedPartition = plan1BoardStatusIndex.partition('completed');
            const plan1BoardPendingPartition = plan1BoardStatusIndex.partition('pending');

            // Apply a filter at the plan level so that it applies to all views
            plan1Partition.applyFilter((task) => (task.priority ?? 0) >= 4);

            expectEqualUnordered(plan1Partition.itemIds(), ['3', '5', '1']);
            expectEqualUnordered(plan1GridPartition.itemIds(), ['3', '5', '1']);
            expectEqualUnordered(plan1BoardPartition.itemIds(), ['3', '5', '1']);
            expectEqualUnordered(plan1BoardCompletedPartition.itemIds(), ['5']);
            expectEqualUnordered(plan1BoardPendingPartition.itemIds(), ['3', '1']);

            // Apply different comparators for the grid and board view partitions
            plan1GridPartition.applyComparator((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
            plan1BoardPartition.applyComparator((a, b) => a.title.localeCompare(b.title));

            expect(plan1GridPartition.itemIds()).toEqual(['3', '5', '1']); // Should be sorted by priority descending
            expect(plan1BoardPartition.itemIds()).toEqual(['1', '3', '5']); // Should be sorted by title alphabetically
            expect(plan1BoardCompletedPartition.itemIds()).toEqual(['5']); // Should be sorted by priority descending
            expect(plan1BoardPendingPartition.itemIds()).toEqual(['1', '3']); // Should be sorted by title alphabetically
        });

        test('should inherit filter/comparator from parent partitions automatically', () => {
            // Create plan index to partition by plan
            table.registerIndex('plan', (task) => task.planId ?? 'default');
            const planIndex = table.index('plan');
            const plan1Partition = planIndex.partition('plan1');

            // Apply a filter at the plan level
            plan1Partition.applyFilter((task) => !!task.isCompleted);
            plan1Partition.applyComparator((a, b) => a.title.localeCompare(b.title));

            // Create a priority class partitioning with one partition that has no items
            plan1Partition.registerIndex('priority', (task) =>
                (task.priority ?? 0) > 0 ? 'prioritized' : 'not-prioritized'
            );
            const plan1PriorityIndex = plan1Partition.index('priority');
            const prioritizedPlan1Partition = plan1PriorityIndex.partition('prioritized');
            const notPrioritizedPlan1Partition = plan1PriorityIndex.partition('not-prioritized');

            expect(plan1Partition.itemIds()).toEqual(['2', '4', '5']);
            expect(prioritizedPlan1Partition.itemIds()).toEqual(['2', '4', '5']);
            expect(notPrioritizedPlan1Partition.itemIds()).toEqual([]); // Empty

            // Add some non-prioritized completed tasks to the partition
            table.set('9', { title: 'Non-Prioritized Task', planId: 'plan1', isCompleted: true });
            table.set('10', {
                title: 'Another Non-Prioritized Task',
                planId: 'plan1',
                isCompleted: true,
            });
            table.set('11', { title: 'Yet Another Task', planId: 'plan1', isCompleted: true });

            expect(plan1Partition.itemIds()).toEqual(['10', '2', '4', '5', '9', '11']);
            expect(prioritizedPlan1Partition.itemIds()).toEqual(['2', '4', '5']);
            expect(notPrioritizedPlan1Partition.itemIds()).toEqual(['10', '9', '11']); // should follow parent partition's order
        });
    });

    describe('Tracking', () => {
        beforeEach(() => {
            table = new Table<ITask>();
            table.registerIndex('title', (task) => task.title);
        });

        test('should track modified items', () => {
            table.set('1', { title: 'Task One' });
            table.set('2', { title: 'Task Two' });

            const delta = table.nextDelta();
            expect(delta.length).toBe(2);
        });

        test('should limit modified items to specified limit', () => {
            for (let i = 0; i < 100; i++) {
                table.set(i.toString(), { title: `Task ${i}` });
            }

            const delta = table.nextDelta(50);
            expect(delta.length).toBe(50);
        });

        test('should return all items if no limit is specified', () => {
            for (let i = 0; i < 100; i++) {
                table.set(i.toString(), { title: `Task ${i}` });
            }

            const delta = table.nextDelta();
            expect(delta.length).toBe(100);
        });

        test('should reset the batches once they are returned', () => {
            for (let i = 0; i < 100; i++) {
                table.set(i.toString(), { title: `Task ${i}` });
            }

            const delta = table.nextDelta();
            expect(delta.length).toBe(100);

            const delta2 = table.nextDelta();
            expect(delta2.length).toBe(0);
        });

        test('should not track non-existent records', () => {
            table.delete('1'); // delete non-existent record
            expect(table.nextDelta().length).toBe(0);
        });

        test('should correctly track deletions', () => {
            table.set('1', { title: 'Task One' });
            table.nextDelta(); // Discard the initial batch

            table.delete('1');
            expect(table.nextDelta()).toEqual(['1']);
        });

        test('should track updates during a batch operation', () => {
            table.set('1', { title: 'Task One' });
            table.set('2', { title: 'Task Two' });
            table.nextDelta(); // Discard the initial batch

            table.runBatch((t) => {
                t.set('1', { title: 'Updated Task One' });
                t.delete('2');
            });

            expect(table.nextDelta().sort()).toEqual(['1', '2']);
        });

        test('tracking disabled', () => {
            table = new Table<ITask>({ deltaTracking: false }); // Disable tracking
            table.set('1', { title: 'Task One' });
            table.set('2', { title: 'Task Two' });

            expect(table.nextDelta().length).toBe(0);
        });
    });

    describe('Subscriptions', () => {
        test('should notify subscribers on item changes', () => {
            table = new Table<ITask>();

            const callback = vi.fn();
            table.subscribe(callback);

            table.set('1', { title: 'Task One' });
            expect(callback).toHaveBeenCalledWith(['1']);

            table.set('2', { title: 'Task Two' });
            expect(callback).toHaveBeenCalledWith(['2']);
        });

        test('nested subscriptions', () => {
            table = new Table<ITask>();
            table.registerIndex('plan', (task) => task.planId ?? 'default');

            table.set('1', { title: 'Task One', planId: 'p1' });
            table.set('2', { title: 'Task Two', planId: 'p2' });

            const p1Callback = vi.fn();
            const p2Callback = vi.fn();

            table.index('plan').partition('p1').subscribe(p1Callback);
            table.index('plan').partition('p2').subscribe(p2Callback);

            // Update task in p1
            table.set('1', { title: 'Updated Task One', planId: 'p1' });
            expect(p1Callback).toHaveBeenCalledWith(['1']);
            expect(p2Callback).not.toHaveBeenCalled();

            // Update task in p2
            table.set('2', { title: 'Updated Task Two', planId: 'p2' });
            expect(p2Callback).toHaveBeenCalledWith(['2']);
        });

        test('batch updates notify subscribers once', () => {
            table = new Table<ITask>();

            const callback = vi.fn();
            table.subscribe(callback);

            table.runBatch((t) => {
                t.set('1', { title: 'Task One' });
                t.set('2', { title: 'Task Two' });
                t.set('3', { title: 'Task Three' });
            });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        test('unsubscribing from notifications', () => {
            table = new Table<ITask>();

            const callback = vi.fn();
            const unsubscribe = table.subscribe(callback);

            table.set('1', { title: 'Task One' });
            expect(callback).toHaveBeenCalledWith(['1']);

            unsubscribe();

            table.set('2', { title: 'Task Two' });
            expect(callback).toHaveBeenCalledTimes(1); // No new calls after unsubscribe
        });
    });

    /**
     * Load factor for tuning load for performance tests. The total time taken for this
     * test should scale log-linearly with the load factor.
     *
     * Some snapshots of runs:
     *
     * | Test                   |   Load:1   |   Load:5   |
     * |------------------------|------------|------------|
     * | N*partition.items()    |   100 ms   |    700 ms  |
     * | N*set()[no-index]      |   300 ms   |   1500 ms  |
     * | N*set()                |   600 ms   |   4200 ms  |
     * | batch(N*set())         |   500 ms   |   2500 ms  |
     * | N*applyComparator()    |   200 ms   |   2400 ms  |
     * | N*applyFilter()        |   700 ms   |   4600 ms  |
     */
    const LOAD_FACTOR = 1; // Set to a lower value for faster CI runs, can be increased for more stress testing
    describe(`Performance (Load:${LOAD_FACTOR})`, () => {
        const N_TASK = LOAD_FACTOR * 100000;
        const N_PLAN = LOAD_FACTOR * 5;
        const N_READ = LOAD_FACTOR * 100;
        const N_SET_BATCH = N_TASK;
        const N_SET = LOAD_FACTOR * 100;
        const N_SET_NO_INDEX = LOAD_FACTOR * 100000;
        const N_APPLY_COMPARATOR = LOAD_FACTOR * 100;
        const N_APPLY_FILTER = LOAD_FACTOR * 100;

        const titleSort = (a: ITask, b: ITask) => a.title.localeCompare(b.title);
        const filter = (task: ITask) => task.priority !== undefined && task.priority > 2;
        const planIndex = (task: ITask) => task.planId ?? 'default';
        const perfTable = new Table<ITask>();
        const emptyPerfTable = new Table<ITask>();

        perfTable.registerIndex('plan', planIndex);
        emptyPerfTable.registerIndex('plan', planIndex);

        perfTable.runBatch((t) => {
            for (let i = 0; i < N_TASK; i++) {
                const task: ITask = {
                    title: `Task ${Math.random().toString(36).substring(7)}`,
                    planId: `plan-${i % N_PLAN}`,
                    priority: Math.floor(Math.random() * 10),
                    tags: [`tag-${i % 10}`],
                    description: `Description for task ${i}`,
                    isCompleted: i % 2 === 0,
                };
                t.set(`task-${i}`, task);
            }
        });

        // Apply the same comparator and filter to all partitions
        const planIds = perfTable.index('plan').keys();
        for (const planId of planIds) {
            const partition = perfTable.index('plan').partition(planId);
            partition.applyFilter(filter);
            partition.applyComparator(titleSort);
        }

        test(`${N_READ}*partition.items()`, () => {
            for (let i = 0; i < N_READ; i++) {
                const planId = `plan-${Math.floor(Math.random() * N_PLAN)}`;
                perfTable.index('plan').partition(planId).items();
            }
        });

        test(`${N_SET_NO_INDEX}*set()[no-view-index]`, () => {
            const table = new Table<ITask>();
            for (let i = 0; i < N_SET_NO_INDEX; i++) {
                const taskId = `task-${Math.floor(Math.random() * N_TASK)}`;
                const task = perfTable.get(taskId);
                if (task) {
                    table.set(taskId, {
                        ...task,
                        title: `Updated Task ${Math.random().toString(36).substring(7)}`,
                        priority: Math.floor(Math.random() * 10),
                        planId: `plan-${Math.floor(Math.random() * N_PLAN)}`,
                    });
                }
            }
        });

        test(`${N_SET}*set()`, () => {
            for (let i = 0; i < N_SET; i++) {
                const taskId = `task-${Math.floor(Math.random() * N_TASK)}`;
                const task = perfTable.get(taskId);
                if (task) {
                    perfTable.set(taskId, {
                        ...task,
                        title: `Updated Task ${Math.random().toString(36).substring(7)}`,
                        priority: Math.floor(Math.random() * 10),
                        planId: `plan-${Math.floor(Math.random() * N_PLAN)}`,
                    });
                }
            }
        });

        test(`batch(${N_SET_BATCH}*set)`, () => {
            emptyPerfTable.runBatch((t) => {
                for (let i = 0; i < N_SET_BATCH; i++) {
                    const task: ITask = {
                        title: `Task ${Math.random().toString(36).substring(7)}`,
                        planId: `plan-${i % N_PLAN}`,
                        priority: Math.floor(Math.random() * 10),
                        tags: [`tag-${i % 10}`],
                        description: `Description for task ${i}`,
                        isCompleted: i % 2 === 0,
                    };
                    t.set(`task-${i}`, task);
                }
            });
        });

        test(`${N_APPLY_COMPARATOR}*applyComparator()`, () => {
            for (let i = 0; i < N_APPLY_COMPARATOR; i++) {
                const planId = `plan-${Math.floor(Math.random() * N_PLAN)}`;
                perfTable.index('plan').partition(planId).applyComparator(titleSort);
            }
        });

        test(`${N_APPLY_FILTER}*applyFilter()`, () => {
            for (let i = 0; i < N_APPLY_FILTER; i++) {
                const planId = `plan-${Math.floor(Math.random() * N_PLAN)}`;
                perfTable.index('plan').partition(planId).applyFilter(filter);
            }
        });
    });
});

function expectEqualUnordered(received: string[], expected: string[]) {
    return (
        received.length === expected.length &&
        [...received].sort().every((val, index) => val === [...expected].sort()[index])
    );
}
