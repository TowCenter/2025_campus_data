export default DataCard;
type DataCard = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const DataCard: import("svelte").Component<{
    /**
     * - Data item
     */
    item: any;
    /**
     * - Formatted date key for timeline (e.g., "January 15, 2025")
     */
    dateKey?: string | undefined;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
    /**
     * - Filter values for highlighting
     */
    filterValues?: Record<string, any> | undefined;
    /**
     * - Card index for unique ID
     */
    index?: number | undefined;
}, {}, "">;
type Props = {
    /**
     * - Data item
     */
    item: any;
    /**
     * - Formatted date key for timeline (e.g., "January 15, 2025")
     */
    dateKey?: string | undefined;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
    /**
     * - Filter values for highlighting
     */
    filterValues?: Record<string, any> | undefined;
    /**
     * - Card index for unique ID
     */
    index?: number | undefined;
};
