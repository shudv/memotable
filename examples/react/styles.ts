import { CSSProperties } from "react";

export const styles = {
    container: {
        padding: "20px",
        fontFamily: "Arial, sans-serif",
    } as CSSProperties,

    heading: {
        marginTop: 0,
        color: "#333",
    } as CSSProperties,

    filterContainer: {
        marginBottom: "20px",
    } as CSSProperties,

    filterInput: {
        padding: "8px 12px",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        width: "300px",
        marginBottom: "12px",
    } as CSSProperties,

    buttonContainer: {
        marginBottom: "20px",
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
    } as CSSProperties,

    button: {
        padding: "8px 16px",
        backgroundColor: "#007bff",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "14px",
    } as CSSProperties,

    buttonDanger: {
        padding: "8px 16px",
        backgroundColor: "#dc3545",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "14px",
    } as CSSProperties,

    buttonSecondary: {
        padding: "8px 16px",
        backgroundColor: "#6c757d",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "14px",
    } as CSSProperties,

    gridContainer: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "16px",
    } as CSSProperties,

    listView: {
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "16px",
        backgroundColor: "#f9f9f9",
        minWidth: "300px",
    } as CSSProperties,

    listViewTitle: {
        marginTop: 0,
        color: "#333",
    } as CSSProperties,

    listViewList: {
        listStyle: "none",
        padding: 0,
    } as CSSProperties,

    listViewItem: {
        padding: "8px",
        marginBottom: "8px",
        backgroundColor: "white",
        borderRadius: "4px",
        border: "1px solid #ddd",
    } as CSSProperties,

    listViewItemTitle: {
        fontWeight: "bold",
    } as CSSProperties,

    listViewItemMeta: {
        fontSize: "12px",
        color: "#666",
    } as CSSProperties,

    importantBadge: {
        color: "red",
        marginLeft: "8px",
    } as CSSProperties,

    listViewCount: {
        fontSize: "12px",
        color: "#999",
    } as CSSProperties,
};
