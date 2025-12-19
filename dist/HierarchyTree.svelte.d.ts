export default HierarchyTree;
type HierarchyTree = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const HierarchyTree: import("svelte").Component<{
    /**
     * - Hierarchy tree node
     */
    tree: Object;
    /**
     * - Parent organization name
     */
    parentName?: string | undefined;
    /**
     * - Interaction type
     */
    interactionType?: string | undefined;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
    /**
     * - Additional search terms
     */
    searchTerms?: string[] | undefined;
}, {}, "">;
type Props = {
    /**
     * - Hierarchy tree node
     */
    tree: Object;
    /**
     * - Parent organization name
     */
    parentName?: string | undefined;
    /**
     * - Interaction type
     */
    interactionType?: string | undefined;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
    /**
     * - Additional search terms
     */
    searchTerms?: string[] | undefined;
};
