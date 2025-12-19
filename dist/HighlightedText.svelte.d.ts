export default HighlightedText;
type HighlightedText = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const HighlightedText: import("svelte").Component<{
    /**
     * - Text to display and highlight
     */
    text: any;
    /**
     * - Search query to highlight
     */
    searchQuery?: string | undefined;
    /**
     * - Additional search terms to highlight
     */
    searchTerms?: string[] | undefined;
}, {}, "">;
type Props = {
    /**
     * - Text to display and highlight
     */
    text: any;
    /**
     * - Search query to highlight
     */
    searchQuery?: string | undefined;
    /**
     * - Additional search terms to highlight
     */
    searchTerms?: string[] | undefined;
};
