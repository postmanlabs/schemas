import type { SchemaFragment } from '../types';
import type { WalkingOptions } from '../walker/types';
export declare function mergeAllOf(fragment: SchemaFragment, path: string[], walkingOptions: WalkingOptions, seen: WeakMap<SchemaFragment, SchemaFragment>): SchemaFragment;
