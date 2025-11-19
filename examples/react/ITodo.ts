// Type of todo task
export interface ITodo {
    id: string;
    title: string;
    listId: string;
    isImportant: boolean;
    createdDate: Date;
    dueDate: Date;
}
