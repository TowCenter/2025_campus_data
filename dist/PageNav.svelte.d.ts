export default PageNav;
type PageNav = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const PageNav: import("svelte").Component<{
    /**
     * - The current active page
     */
    activePage?: string | undefined;
}, {}, "">;
type Props = {
    /**
     * - The current active page
     */
    activePage?: string | undefined;
};
