import {
  BooleanishNode,
  isMirroredNode,
  isReferenceNode,
  isRegularNode,
  isRootNode,
  MirroredReferenceNode,
  MirroredRegularNode,
  ReferenceNode,
  RegularNode,
  RootNode,
  type SchemaFragment,
  type SchemaNode,
} from './vendor/index.js';

/**
 * Serialization / deserialization ("serde") for a populated json-schema-tree.
 *
 * Why this exists
 * ---------------
 * Building the tree (`new SchemaTree(...).populate()`) is the dominant cost when
 * switching schemas — it dereferences `$ref`s and merges `allOf`s. We want to run
 * that work in a Web Worker so it never blocks the main thread. But the populated
 * tree can't be handed back over `postMessage`'s structured clone:
 *
 *   - Nodes expose key fields as *prototype getters* (`unknown`, `simple`,
 *     `external`, `path`, `depth`, ...). Structured clone copies only own data
 *     properties, so those getters would be lost.
 *   - `MirroredRegularNode` is a `Proxy` backed by a `WeakMap` with a lazy,
 *     potentially-infinite `children` getter (used for recursive schemas). Proxies
 *     and WeakMaps aren't cloneable at all, and eagerly walking their children
 *     would never terminate.
 *
 * So instead of cloning instances, we serialize a flat, id-keyed description of the
 * graph (plain JSON, safe for `postMessage`) and *reconstruct real instances* on the
 * other side by calling the node constructors. Because every derived field is
 * recomputed from `fragment` by the constructor, and `parent`/`children` links are
 * restored, all getters work exactly as if the tree had been built locally. Mirror
 * nodes are stored as a reference to their mirrored (real) node; their Proxy, cache
 * and lazy children are rebuilt live by the constructor on deserialize.
 */

type NodeKind = 'root' | 'regular' | 'reference' | 'booleanish' | 'mirroredRegular' | 'mirroredReference';

interface BaseSer {
  id: string;
  subpath: string[];
  parent: string | null;
}
interface RootSer extends BaseSer {
  k: 'root';
  fragment: SchemaFragment;
  children: string[];
}
interface RegularSer extends BaseSer {
  k: 'regular';
  fragment: SchemaFragment;
  // Omitted when identical to `fragment` (the common case for plain nodes) to keep the
  // serialized payload small; the RegularNode constructor defaults it back to fragment.
  originalFragment?: SchemaFragment;
  children: string[] | null | undefined;
}
interface ReferenceSer extends BaseSer {
  k: 'reference';
  fragment: SchemaFragment;
  error: string | null;
}
interface BooleanishSer extends BaseSer {
  k: 'booleanish';
  fragment: boolean;
}
interface MirroredRegularSer extends BaseSer {
  k: 'mirroredRegular';
  mirrored: string;
  originalFragment: SchemaFragment;
}
interface MirroredReferenceSer extends BaseSer {
  k: 'mirroredReference';
  mirrored: string;
}

type SerializedNode =
  | RootSer
  | RegularSer
  | ReferenceSer
  | BooleanishSer
  | MirroredRegularSer
  | MirroredReferenceSer;

/** A structured-clone-safe, `postMessage`-transferable representation of a tree. */
export interface SerializedTree {
  rootId: string;
  nodes: Record<string, SerializedNode>;
}

function kindOf(node: SchemaNode): NodeKind {
  // Order matters: mirror nodes duck-type as regular/reference (they forward those
  // props to their mirrored node), so check `isMirroredNode` first.
  if (isRootNode(node)) return 'root';
  if (isMirroredNode(node)) return isRegularNode(node) ? 'mirroredRegular' : 'mirroredReference';
  if (typeof node.fragment === 'boolean') return 'booleanish';
  if (isReferenceNode(node)) return 'reference';
  return 'regular';
}

/** Walk a populated tree into a flat, transferable description. */
export function serializeTree(root: RootNode): SerializedTree {
  const nodes: Record<string, SerializedNode> = {};

  const visit = (node: SchemaNode): string => {
    const id = node.id;
    if (id in nodes) return id;

    const parent = node.parent ? node.parent.id : null;

    switch (kindOf(node)) {
      case 'root': {
        const rn = node as RootNode;
        const ser: RootSer = { k: 'root', id, subpath: node.subpath, parent: null, fragment: rn.fragment, children: [] };
        nodes[id] = ser; // reserve before recursing to break cycles
        ser.children = rn.children.map(visit);
        break;
      }
      case 'regular': {
        const rn = node as RegularNode;
        const ser: RegularSer = {
          k: 'regular',
          id,
          subpath: node.subpath,
          parent,
          fragment: rn.fragment,
          children: undefined,
        };
        if (rn.originalFragment !== rn.fragment) ser.originalFragment = rn.originalFragment;
        nodes[id] = ser;
        ser.children = rn.children == null ? rn.children : rn.children.map(visit);
        break;
      }
      case 'reference': {
        const rn = node as ReferenceNode;
        nodes[id] = { k: 'reference', id, subpath: node.subpath, parent, fragment: rn.fragment, error: rn.error };
        break;
      }
      case 'booleanish': {
        nodes[id] = { k: 'booleanish', id, subpath: node.subpath, parent, fragment: node.fragment as boolean };
        break;
      }
      case 'mirroredRegular': {
        const mn = node as unknown as MirroredRegularNode;
        const ser: MirroredRegularSer = {
          k: 'mirroredRegular',
          id,
          subpath: node.subpath,
          parent,
          mirrored: '',
          originalFragment: mn.originalFragment,
        };
        nodes[id] = ser;
        // Capture the real (mirrored) node — it's reachable from the root, but do it
        // explicitly so an edge-case where it was filtered out of `children` is safe.
        // Crucially we do NOT recurse into the mirror's own (lazy, recursive) children.
        ser.mirrored = visit(mn.mirroredNode as unknown as SchemaNode);
        break;
      }
      case 'mirroredReference': {
        const mn = node as unknown as MirroredReferenceNode;
        const ser: MirroredReferenceSer = { k: 'mirroredReference', id, subpath: node.subpath, parent, mirrored: '' };
        nodes[id] = ser;
        ser.mirrored = visit(mn.mirroredNode as unknown as SchemaNode);
        break;
      }
    }

    return id;
  };

  return { rootId: visit(root), nodes };
}

/** Rebuild a real, fully-functional tree of node instances from its description. */
export function deserializeTree(data: SerializedTree): RootNode {
  const { nodes, rootId } = data;
  // `any` because BaseNode fields (id/parent/children) are declared readonly; they
  // are ordinary writable properties at runtime.
  const instances: Record<string, any> = {};

  // Pass 1: real nodes. Constructors recompute every derived field from `fragment`.
  for (const id in nodes) {
    const s = nodes[id];
    let inst: any;
    switch (s.k) {
      case 'root':
        inst = new RootNode(s.fragment);
        break;
      case 'regular':
        inst = new RegularNode(s.fragment, { originalFragment: s.originalFragment });
        break;
      case 'reference':
        inst = new ReferenceNode(s.fragment, s.error);
        break;
      case 'booleanish':
        inst = new BooleanishNode(s.fragment);
        break;
      default:
        continue; // mirrors handled in pass 2
    }
    inst.id = s.id;
    inst.subpath = s.subpath;
    instances[id] = inst;
  }

  // Pass 2: mirror nodes (need their real mirrored instance to exist first).
  for (const id in nodes) {
    const s = nodes[id];
    if (s.k !== 'mirroredRegular' && s.k !== 'mirroredReference') continue;
    const mirrored = instances[s.mirrored];
    const inst: any =
      s.k === 'mirroredRegular'
        ? new MirroredRegularNode(mirrored, { originalFragment: s.originalFragment })
        : new MirroredReferenceNode(mirrored);
    inst.id = s.id;
    inst.subpath = s.subpath;
    instances[id] = inst;
  }

  // Pass 3: relink parent/children. Mirror children are intentionally left to the
  // live lazy getter (do not assign — it has no setter).
  for (const id in nodes) {
    const s = nodes[id];
    const inst = instances[id];
    inst.parent = s.parent ? instances[s.parent] : null;
    if (s.k === 'root') {
      inst.children = s.children.map((cid) => instances[cid]);
    } else if (s.k === 'regular') {
      inst.children = s.children == null ? s.children : s.children.map((cid) => instances[cid]);
    }
  }

  return instances[rootId] as RootNode;
}
