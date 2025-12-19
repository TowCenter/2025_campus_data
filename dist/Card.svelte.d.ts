export default Card;
type Card = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const Card: import("svelte").Component<{
    /**
     * - Data row
     */
    row: Object;
    /**
     * - Unique card identifier
     */
    cardId: string;
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
     * - Unique card identifier
     */
    cardId: string;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
    /**
     * - Filter publishers for highlighting
     */
    filterPublishers?: string[] | undefined;
};
