export default OrganizationList;
type OrganizationList = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const OrganizationList: import("svelte").Component<{
    /**
     * - Data array
     */
    data?: any[] | undefined;
    /**
     * - Field name for organization
     */
    orgField?: string | undefined;
    /**
     * - Maximum number of organizations to show
     */
    maxItems?: number | undefined;
}, {}, "">;
type Props = {
    /**
     * - Data array
     */
    data?: any[] | undefined;
    /**
     * - Field name for organization
     */
    orgField?: string | undefined;
    /**
     * - Maximum number of organizations to show
     */
    maxItems?: number | undefined;
};
