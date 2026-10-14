import { isPlainObject } from '@stoplight/json';
import type { SchemaNode } from '@postman/json-schema-tree';

// for easier debugging the values going into hash
let SKIP_HASHING = false;

export const setSkipHashing = (skip: boolean) => {
  SKIP_HASHING = skip;
};

// Inlined, pure-JS port of `fnv-plus`'s `fast1a52hex` (FNV-1a, 52-bit, hex output).
//
// The upstream viewer used `import * as fnv from 'fnv-plus'` then `fnv.fast1a52hex(value)`.
// `fnv-plus` is a CommonJS module whose exports are not statically analyzable, so under
// SSR bundling on workerd the named methods only exist on `.default` and calling
// `fnv.fast1a52hex` throws `TypeError: fnv.fast1a52hex is not a function`. Inlining removes
// the dependency and the ESM/CJS interop hazard entirely.
//
// This is a byte-for-byte reimplementation of `_hash52_1a_fast_hex` from fnv-plus@1.3.1
// (defaults: version '1a', keyspace 52, non-UTF8), so the produced ids are IDENTICAL to
// the original. Node ids MUST stay stable/deterministic and match between server render and
// client hydration to avoid React hydration mismatches (and to keep parity with stored ids).
const hl: string[] = [];
for (let i = 0; i < 256; i++) {
  hl[i] = ((i >> 4) & 15).toString(16) + (i & 15).toString(16);
}
const hl16 = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];

const fast1a52hex = (str: string): string => {
  const l = str.length - 3;
  let i: number;
  let t0 = 0;
  let v0 = 0x2325;
  let t1 = 0;
  let v1 = 0x8422;
  let t2 = 0;
  let v2 = 0x9ce4;
  let t3 = 0;
  let v3 = 0xcbf2;

  for (i = 0; i < l; ) {
    v0 ^= str.charCodeAt(i++);
    t0 = v0 * 435; t1 = v1 * 435; t2 = v2 * 435; t3 = v3 * 435;
    t2 += v0 << 8; t3 += v1 << 8;
    t1 += t0 >>> 16; v0 = t0 & 65535; t2 += t1 >>> 16; v1 = t1 & 65535; v3 = (t3 + (t2 >>> 16)) & 65535; v2 = t2 & 65535;
    v0 ^= str.charCodeAt(i++);
    t0 = v0 * 435; t1 = v1 * 435; t2 = v2 * 435; t3 = v3 * 435;
    t2 += v0 << 8; t3 += v1 << 8;
    t1 += t0 >>> 16; v0 = t0 & 65535; t2 += t1 >>> 16; v1 = t1 & 65535; v3 = (t3 + (t2 >>> 16)) & 65535; v2 = t2 & 65535;
    v0 ^= str.charCodeAt(i++);
    t0 = v0 * 435; t1 = v1 * 435; t2 = v2 * 435; t3 = v3 * 435;
    t2 += v0 << 8; t3 += v1 << 8;
    t1 += t0 >>> 16; v0 = t0 & 65535; t2 += t1 >>> 16; v1 = t1 & 65535; v3 = (t3 + (t2 >>> 16)) & 65535; v2 = t2 & 65535;
    v0 ^= str.charCodeAt(i++);
    t0 = v0 * 435; t1 = v1 * 435; t2 = v2 * 435; t3 = v3 * 435;
    t2 += v0 << 8; t3 += v1 << 8;
    t1 += t0 >>> 16; v0 = t0 & 65535; t2 += t1 >>> 16; v1 = t1 & 65535; v3 = (t3 + (t2 >>> 16)) & 65535; v2 = t2 & 65535;
  }

  while (i < l + 3) {
    v0 ^= str.charCodeAt(i++);
    t0 = v0 * 435; t1 = v1 * 435; t2 = v2 * 435; t3 = v3 * 435;
    t2 += v0 << 8; t3 += v1 << 8;
    t1 += t0 >>> 16; v0 = t0 & 65535; t2 += t1 >>> 16; v1 = t1 & 65535; v3 = (t3 + (t2 >>> 16)) & 65535; v2 = t2 & 65535;
  }

  return (
    hl16[v3 & 15] +
    hl[v2 >> 8] +
    hl[v2 & 255] +
    hl[v1 >> 8] +
    hl[v1 & 255] +
    hl[(v0 >> 8) ^ (v3 >> 12)] +
    hl[(v0 ^ (v3 >> 4)) & 255]
  );
};

export const hash = (value: string, skipHashing: boolean = SKIP_HASHING): string => {
  // Never change this, as it would affect how the default stable id is generated, and cause mismatches with whatever
  // we already have stored in our DB etc.
  return skipHashing ? value : fast1a52hex(value);
};

export const getNodeId = (node: SchemaNode, parentId?: string): string => {
  const fragment = node.fragment;

  if (isPlainObject(fragment) && isPlainObject(fragment['x-stoplight'])) {
    const nodeId = fragment['x-stoplight'].id;
    if (typeof nodeId === 'string') return nodeId;
  }

  const key = node.path[node.path.length - 1];

  return hash(['schema_property', parentId, String(key)].join('-'));
};

export const getOriginalNodeId = (node: SchemaNode, parentId?: string): string => {
  // @ts-expect-error originalFragment does exist...
  const nodeId = node.originalFragment?.['x-stoplight']?.id;
  if (nodeId) return nodeId;

  const key = node.path[node.path.length - 1];

  return hash(['schema_property', parentId, String(key)].join('-'));
};
