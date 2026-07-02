import type { Excuse, ExcuseCategory } from './types.js';
interface Sighting {
    text: string;
    count: number;
    firstSeen: string;
    lastSeen: string;
    suggestedCategory: ExcuseCategory;
    suggestedRebuttal: string;
    promoted: boolean;
}
export declare function recordSighting(text: string, category?: ExcuseCategory, rebuttal?: string, projectDir?: string): {
    isNew: boolean;
    count: number;
    autoPromoted: boolean;
    excuse: Excuse | null;
};
export declare function loadCustomExcuses(projectDir?: string): Excuse[];
export declare function listSightings(projectDir?: string): Sighting[];
export {};
