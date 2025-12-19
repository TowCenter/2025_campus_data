export default CardContent;
type CardContent = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const CardContent: import("svelte").Component<{
    /**
     * - Data row
     */
    row: Object;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
    /**
     * - Filter publishers for highlighting
     */
    filterPublishers?: string[] | undefined;
}, {}, "">;
type Props = {
    /**
     * - Data row
     */
    row: Object;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
    /**
     * - Filter publishers for highlighting
     */
    filterPublishers?: string[] | undefined;
};
