import type { SchemaFragment } from '../types';
import { BaseNode } from './BaseNode';
export declare class ReferenceNode extends BaseNode {
    readonly fragment: SchemaFragment;
    readonly error: string | null;
    readonly value: string | null;
    constructor(fragment: SchemaFragment, error: string | null);
    get external(): boolean;
}
