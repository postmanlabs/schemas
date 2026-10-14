/**
 * Tiny local reimplementations of the handful of lodash helpers the viewer uses.
 *
 * The upstream viewer imported deep paths like `lodash/compact.js`, `lodash/last.js`, etc.
 * Those deep CJS entrypoints are NOT resolvable at runtime on Cloudflare workerd
 * (`No such module "lodash/last.js"`), and importing the lodash barrel (`import { x } from 'lodash'`)
 * pulls in the entire library. These pure, dependency-free helpers bundle cleanly for both
 * Node SSR and workerd, and match lodash semantics for the inputs used here.
 */

const toStr = (value: unknown): string => (value == null ? '' : String(value));

/** Uppercase the first character; leave the rest unchanged. */
export const upperFirst = (value: string): string => {
  const str = toStr(value);
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/** Uppercase the first character and lowercase the rest (lodash `capitalize`). */
export const capitalize = (value: string): string => upperFirst(toStr(value).toLowerCase());

/** Own enumerable string keys (lodash `keys` for plain objects). */
export const keys = (obj: unknown): string[] => (obj == null ? [] : Object.keys(obj as object));

/** Last element of an array/array-like, or `undefined` when empty. */
export const last = <T>(arr: ArrayLike<T> | null | undefined): T | undefined =>
  arr != null && arr.length ? arr[arr.length - 1] : undefined;

/** Unique values preserving order (SameValueZero, like lodash `uniq`). */
export const uniq = <T>(arr: readonly T[] | null | undefined): T[] => (arr == null ? [] : Array.from(new Set(arr)));

/** Shallow object with only the given keys that exist on the source. */
export const pick = <T extends object>(obj: T | null | undefined, paths: readonly (keyof T | string)[]): Partial<T> => {
  const result: Partial<T> = {};
  if (obj == null) return result;
  for (const key of paths) {
    if (key in (obj as object)) {
      (result as Record<string, unknown>)[key as string] = (obj as Record<string, unknown>)[key as string];
    }
  }
  return result;
};

/** Shallow object without the given keys (flat key omission, like lodash `omit` for string keys). */
export const omit = <T extends object>(obj: T | null | undefined, paths: readonly (keyof T | string)[]): Partial<T> => {
  const result: Partial<T> = {};
  if (obj == null) return result;
  const excluded = new Set<string>(paths.map(String));
  for (const key of Object.keys(obj as object)) {
    if (!excluded.has(key)) {
      (result as Record<string, unknown>)[key] = (obj as Record<string, unknown>)[key];
    }
  }
  return result;
};

/** True for empty collections/objects/strings and nullish values (lodash `isEmpty`). */
export const isEmpty = (value: unknown): boolean => {
  if (value == null) return true;
  if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return true;
};
