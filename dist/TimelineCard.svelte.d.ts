export default TimelineCard;
type TimelineCard = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const TimelineCard: import("svelte").Component<{
    date?: string;
    dateKey?: string;
    title?: string;
    description?: string;
    platform?: string | string[];
    category?: string[];
    links?: any[];
    searchQuery?: string;
    filterValues?: Record<string, any>;
}, {}, "">;
type $$ComponentProps = {
    date?: string;
    dateKey?: string;
    title?: string;
    description?: string;
    platform?: string | string[];
    category?: string[];
    links?: any[];
    searchQuery?: string;
    filterValues?: Record<string, any>;
};
