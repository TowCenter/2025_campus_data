export default SourcesList;
type SourcesList = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const SourcesList: import("svelte").Component<{
    /**
     * - Sources data
     */
    sources: any;
    /**
     * - Interaction type
     */
    interactionType?: string | undefined;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
}, {}, "">;
type Props = {
    /**
     * - Sources data
     */
    sources: any;
    /**
     * - Interaction type
     */
    interactionType?: string | undefined;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
};
