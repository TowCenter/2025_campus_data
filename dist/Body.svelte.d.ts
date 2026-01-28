export default Body;
type Body = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const Body: import("svelte").Component<{
    /**
     * - Content to render
     */
    children: import("svelte").Snippet;
    /**
     * - Navigation items for left sidebar
     */
    navItems?: {
        /**
         * - Link anchor
         */
        href: string;
        /**
         * - Link text
         */
        label: string;
    }[] | undefined;
    /**
     * - Whether to show the left sidebar navigation
     */
    showLeftNav?: boolean | undefined;
}, {}, "">;
type Props = {
    /**
     * - Content to render
     */
    children: import("svelte").Snippet;
    /**
     * - Navigation items for left sidebar
     */
    navItems?: {
        /**
         * - Link anchor
         */
        href: string;
        /**
         * - Link text
         */
        label: string;
    }[] | undefined;
    /**
     * - Whether to show the left sidebar navigation
     */
    showLeftNav?: boolean | undefined;
};
