import { extractPointerFromRef, isPlainObject, pointerToPath } from '@stoplight/json';
import { isReferenceNode, isRegularNode, SchemaNode } from '@postman/json-schema-tree';
import { last } from '../../lodashLite';
import * as React from 'react';

import { isComplexArray, isNonEmptyParentNode } from '../../tree';
import { printName } from '../../utils';

/** one option among several mutually exclusive sub-schemas */
export type Choice = {
  title: string;
  type: SchemaNode;
};

function calculateChoiceTitle(node: SchemaNode, isPlural: boolean): string {
  const primitiveSuffix = isPlural ? 's' : '';
  if (isRegularNode(node)) {
    const realName = printName(node, { shouldUseRefNameFallback: true });
    if (realName) {
      return realName;
    }
    return node.primaryType !== null
      ? node.primaryType + primitiveSuffix
      : String(node.originalFragment.title || 'any');
  }
  if (isReferenceNode(node)) {
    if (node.value) {
      const value = extractPointerFromRef(node.value);
      const lastPiece = !node.error && value ? last(pointerToPath(value)) : null;
      if (typeof lastPiece === 'string') {
        return lastPiece.split('.')[0];
      }
    }
    return '$ref' + primitiveSuffix;
  }

  return 'any';
}

function makeChoice(node: SchemaNode): Choice {
  return {
    type: node,
    title: calculateChoiceTitle(node, false),
  };
}

function makeArrayChoice(node: SchemaNode): Choice {
  const itemTitle = calculateChoiceTitle(node, true);
  // The array/combiner is shown once on the dropdown trigger, so each option is
  // just the item's own title rather than "array (oneOf) [title]" repeated.
  return {
    type: node,
    title: itemTitle !== 'any' ? itemTitle : 'array',
  };
}

/** The title a variant would get without its own (inherited) `title`. */
function typeName(node: SchemaNode, isPlural: boolean): string | null {
  if (!isRegularNode(node) || node.primaryType === null) return null;
  return node.primaryType + (isPlural ? 's' : '');
}

function printConst(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** `parentTitles`: the combiner's own title, plus the array's when the combiner is its items. */
type TitleRule = (choices: Choice[], parentTitles: (string | null)[], isPlural: boolean) => (string | null)[];

// Applied in order, and only to choices whose titles still collide.
const TITLE_RULES: TitleRule[] = [
  // 1. A title that only repeats the parent's title → the type name.
  (choices, parentTitles, isPlural) =>
    choices.map(({ type }) =>
      isRegularNode(type) && type.title !== null && parentTitles.includes(type.title) ? typeName(type, isPlural) : null,
    ),
  // 2. A const variant → its value; an enum variant → "<type> (enum)".
  (choices, _parentTitles, isPlural) =>
    choices.map(({ type }) => {
      if (!isRegularNode(type)) return null;
      if ('const' in type.fragment) return printConst(type.fragment.const);
      if (Array.isArray(type.fragment.enum)) return `${typeName(type, isPlural) ?? 'any'} (enum)`;
      return null;
    }),
  // 3. Objects sharing a property that is a different const in each → "<prop>: <value>".
  choices => {
    const properties = choices.map(({ type }) =>
      isRegularNode(type) && isPlainObject(type.fragment.properties)
        ? (type.fragment.properties as Record<string, unknown>)
        : null,
    );
    if (properties.some(props => props === null)) return choices.map(() => null);
    for (const prop of Object.keys(properties[0]!)) {
      const values = properties.map(props => {
        const schema = props![prop];
        return isPlainObject(schema) && 'const' in schema ? printConst(schema.const) : null;
      });
      if (values.every(v => v !== null) && new Set(values).size === values.length) {
        return values.map(v => `${prop}: ${v}`);
      }
    }
    return choices.map(() => null);
  },
];

function collidingGroups(choices: Choice[]): Choice[][] {
  const byTitle = new Map<string, Choice[]>();
  for (const choice of choices) {
    byTitle.set(choice.title, [...(byTitle.get(choice.title) ?? []), choice]);
  }
  return [...byTitle.values()].filter(group => group.length > 1);
}

/**
 * Gives choices that share a title distinct, meaningful labels. Choices whose
 * titles don't collide keep them unchanged.
 */
function disambiguateTitles(choices: Choice[], parentTitles: (string | null)[], isPlural: boolean): Choice[] {
  let result = choices;
  for (const rule of TITLE_RULES) {
    for (const group of collidingGroups(result)) {
      const ruleTitles = rule(group, parentTitles, isPlural);
      result = result.map(choice => {
        const title = group.includes(choice) ? ruleTitles[group.indexOf(choice)] : null;
        return title != null ? { ...choice, title } : choice;
      });
    }
  }
  // 4. Last resort: an ordinal suffix.
  for (const group of collidingGroups(result)) {
    result = result.map(choice =>
      group.includes(choice) ? { ...choice, title: `${choice.title} (${group.indexOf(choice) + 1})` } : choice,
    );
  }
  return result;
}

/** Every title is "<parent title> (...)", e.g. "Variable (requires id)". */
function isNamedVariantList(choices: Choice[], parentTitles: (string | null)[]): boolean {
  return parentTitles.some(
    parent => parent !== null && choices.every(choice => choice.title.startsWith(`${parent} (`)),
  );
}

/**
 * Enumerates the sub-schema types for a given node.
 *
 * Usually a node has one choice, only one possible type: itself. If a node is
 * a oneOf or anyOf combiner, the possible types are the sub-types of the
 * combiner.
 */
export function buildChoices(schemaNode: SchemaNode): Choice[] {
  // handle flattening of arrays that contain oneOfs, same logic as below
  if (
    isComplexArray(schemaNode) &&
    isNonEmptyParentNode(schemaNode.children[0]) &&
    shouldShowChildSelector(schemaNode.children[0])
  ) {
    const combinerNode = schemaNode.children[0];
    const parentTitles = [combinerNode.title, schemaNode.title];
    const choices = combinerNode.children.map(makeArrayChoice);
    // Variants the schema names after their parent ("Variable (requires id)", ...)
    // stay in schema order, so the list opens on the first one. Otherwise sort, and
    // do it before disambiguating so colliding variants keep their schema order
    // (and the default choice stays the same).
    const sorted = isNamedVariantList(choices, parentTitles)
      ? choices
      : choices.sort((a, b) => a.title.localeCompare(b.title));
    return disambiguateTitles(sorted, parentTitles, true);
  }

  // if current node is a combiner, offer its children
  if (isNonEmptyParentNode(schemaNode) && shouldShowChildSelector(schemaNode)) {
    // An array's items combiner is shown under the array's title, so check that too.
    const arrayTitle =
      schemaNode.subpath[0] === 'items' && schemaNode.parent && isRegularNode(schemaNode.parent)
        ? schemaNode.parent.title
        : null;
    return disambiguateTitles(schemaNode.children.map(makeChoice), [schemaNode.title, arrayTitle], false);
  }
  // regular node, single choice - itself
  return [makeChoice(schemaNode)];
}

export const useChoices = (schemaNode: SchemaNode) => {
  const choices: Choice[] = React.useMemo(() => buildChoices(schemaNode), [schemaNode]);

  const defaultChoice = choices[0];

  const [selectedChoice, setSelectedChoice] = React.useState<Choice | undefined>(defaultChoice);

  React.useEffect(() => {
    setSelectedChoice(defaultChoice);
  }, [defaultChoice]);

  const actualSelectedChoice = selectedChoice && choices.includes(selectedChoice) ? selectedChoice : defaultChoice;

  return { selectedChoice: actualSelectedChoice, setSelectedChoice, choices };
};

const shouldShowChildSelector = (schemaNode: SchemaNode) =>
  isNonEmptyParentNode(schemaNode) && ['anyOf', 'oneOf'].includes(schemaNode.combiners?.[0] ?? '');
