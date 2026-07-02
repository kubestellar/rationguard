export interface Excuse {
    pattern: string;
    rebuttal: string;
    category: ExcuseCategory;
    keywords: string[];
}
export type ExcuseCategory = 'false-completion' | 'complexity-dodge' | 'deferral' | 'lane-confusion' | 'partial-credit';
export interface MatchResult {
    matched: boolean;
    excuse: Excuse | null;
    confidence: number;
    matchedText: string;
}
export interface CheckResult {
    input: string;
    matches: MatchResult[];
    clean: boolean;
}
export interface RationguardConfig {
    excuses: Excuse[];
}
export declare const CATEGORY_LABELS: Record<ExcuseCategory, string>;
