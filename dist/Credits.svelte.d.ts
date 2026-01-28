export default Credits;
type Credits = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const Credits: import("svelte").Component<{
    /**
     * - Maintained by credits
     */
    maintainedBy?: {
        /**
         * - Person/entity name
         */
        name: string;
        /**
         * - URL (optional)
         */
        url: string;
    }[] | undefined;
    /**
     * - Design/development credits
     */
    designDevelopment?: {
        /**
         * - Person/entity name
         */
        name: string;
        /**
         * - URL (optional)
         */
        url: string;
    }[] | undefined;
    /**
     * - Acknowledgements text
     */
    acknowledgements?: string | undefined;
}, {}, "">;
type Props = {
    /**
     * - Maintained by credits
     */
    maintainedBy?: {
        /**
         * - Person/entity name
         */
        name: string;
        /**
         * - URL (optional)
         */
        url: string;
    }[] | undefined;
    /**
     * - Design/development credits
     */
    designDevelopment?: {
        /**
         * - Person/entity name
         */
        name: string;
        /**
         * - URL (optional)
         */
        url: string;
    }[] | undefined;
    /**
     * - Acknowledgements text
     */
    acknowledgements?: string | undefined;
};
