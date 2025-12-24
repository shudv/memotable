import { CSSProperties } from "react";

export const styles = {
    container: {
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        maxWidth: "1200px",
        margin: "0 auto",
    } as CSSProperties,

    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
    } as CSSProperties,

    title: {
        margin: 0,
    } as CSSProperties,

    description: {
        color: "#666",
        marginBottom: "20px",
    } as CSSProperties,

    tabs: {
        display: "flex",
        gap: "10px",
        marginBottom: "20px",
        borderBottom: "2px solid #ddd",
    } as CSSProperties,

    tab: {
        padding: "10px 20px",
        cursor: "pointer",
        border: "none",
        background: "none",
        fontSize: "16px",
        fontWeight: "500",
        borderBottom: "3px solid transparent",
        transition: "all 0.2s",
    } as CSSProperties,

    activeTab: {
        padding: "10px 20px",
        cursor: "pointer",
        border: "none",
        background: "none",
        fontSize: "16px",
        fontWeight: "500",
        borderBottom: "3px solid #007bff",
        color: "#007bff",
    } as CSSProperties,

    forceRenderButton: {
        padding: "10px 20px",
        backgroundColor: "#ff6b6b",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "600",
        transition: "background-color 0.2s",
        boxShadow: "0 2px 4px rgba(255, 107, 107, 0.3)",
    } as CSSProperties,

    listContainer: {
        border: "1px solid #ddd",
        borderRadius: "8px",
        overflow: "auto",
        height: "500px",
    } as CSSProperties,

    todoItem: {
        padding: "10px 15px",
        borderBottom: "1px solid #eee",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    } as CSSProperties,

    todoTitle: {
        fontWeight: "600",
        fontSize: "14px",
        marginBottom: "4px",
    } as CSSProperties,

    todoMeta: {
        fontSize: "12px",
        color: "#666",
    } as CSSProperties,

    importantBadge: {
        marginLeft: "8px",
        fontSize: "12px",
    } as CSSProperties,
};
