import type { MirroredRegularNode } from './mirrored';
import type { RegularNode } from './RegularNode';
import type { RootNode } from './RootNode';
export declare abstract class BaseNode {
    readonly id: string;
    parent: RegularNode | RootNode | MirroredRegularNode | null;
    subpath: string[];
    get path(): ReadonlyArray<string>;
    get depth(): number;
    private get parentChildren();
    get pos(): number;
    get isFirst(): boolean;
    get isLast(): boolean;
    protected constructor();
}
