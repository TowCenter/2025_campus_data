export default DataTableRow;
type DataTableRow = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const DataTableRow: import("svelte").Component<{
    /**
     * - Data item
     */
    item: any;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
    /**
     * - Filter values for highlighting
     */
    filterValues?: Record<string, any> | undefined;
    /**
     * - Field name for date
     */
    dateField?: string | undefined;
}, {}, "">;
type Props = {
    /**
     * - Data item
     */
    item: any;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
    /**
     * - Filter values for highlighting
     */
    filterValues?: Record<string, any> | undefined;
    /**
     * - Field name for date
     */
    dateField?: string | undefined;
};
