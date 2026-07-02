import type { CheckResult, RationguardConfig } from './types.js';
export declare function check(text: string, config?: RationguardConfig): CheckResult;
export declare function generatePromptBlock(config?: RationguardConfig): string;
