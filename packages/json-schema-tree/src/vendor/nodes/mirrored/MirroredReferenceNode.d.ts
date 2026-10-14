import type { SchemaFragment } from '../../types';
import { BaseNode } from '../BaseNode';
import type { ReferenceNode } from '../ReferenceNode';
export declare class MirroredReferenceNode extends BaseNode implements ReferenceNode {
    readonly mirroredNode: ReferenceNode;
    readonly fragment: SchemaFragment;
    constructor(mirroredNode: ReferenceNode);
    get error(): string | null;
    get value(): string | null;
    get external(): boolean;
}
