import {
  isRegularNode,
  RootNode,
  SchemaTree as JsonSchemaTree,
  SchemaTreeRefDereferenceFn,
} from '@postman/json-schema-tree';
import { Box, Provider as MosaicProvider } from '../ui';
import { ErrorBoundaryForwardedProps, FallbackProps, withErrorBoundary } from '@stoplight/react-error-boundary';
import cn from 'classnames';
import { Provider } from 'jotai';
import { useSetAtom } from 'jotai';
import * as React from 'react';

import { JSVOptions, JSVOptionsContextProvider } from '../contexts';
import { shouldNodeBeIncluded } from '../tree/utils';
import { JSONSchema } from '../types';
import { TopLevelSchemaRow } from './SchemaRow';
import { hoveredNodeAtom } from './SchemaRow/state';

/** A tree built ahead of time (e.g. off the main thread in a Web Worker). */
export interface PrebuiltSchemaTree {
  root: RootNode;
  nodeCount: number;
}

export type JsonSchemaProps = Partial<JSVOptions> & {
  schema: JSONSchema;
  /**
   * A pre-populated tree. When provided the viewer renders it directly instead of
   * building from `schema`, enabling an instant, off-main-thread render. When omitted
   * the tree is built synchronously from `schema` (used for SSR and as a fallback for
   * schemas that weren't prefetched).
   */
  tree?: PrebuiltSchemaTree;
  /**
   * Optional display name for the schema. Accepted for API compatibility with how the
   * upstream npm package was consumed (the app wrapper passes it); it is not used for
   * rendering and is intentionally ignored (dropped via `...rest`).
   */
  name?: string;
  emptyText?: string;
  className?: string;
  resolveRef?: SchemaTreeRefDereferenceFn;
  /** Controls the level of recursion of refs. Prevents overly complex trees and running out of stack depth. */
  maxRefDepth?: number;
  onTreePopulated?: (props: { rootNode: RootNode; nodeCount: number }) => void;
  maxHeight?: number;
  skipTopLevelDescription?: boolean;
};

const JsonSchemaViewerComponent = ({
  viewMode = 'standalone',
  defaultExpandedDepth = 1,
  onGoToRef,
  renderRowAddon,
  renderExtensionAddon,
  hideExamples,
  renderRootTreeLines,
  nodeHasChanged,
  skipTopLevelDescription,
  ...rest
}: JsonSchemaProps & ErrorBoundaryForwardedProps) => {
  const options = React.useMemo(
    () => ({
      defaultExpandedDepth,
      viewMode,
      onGoToRef,
      renderRowAddon,
      renderExtensionAddon,
      hideExamples,
      renderRootTreeLines,
      nodeHasChanged,
    }),
    [
      defaultExpandedDepth,
      viewMode,
      onGoToRef,
      renderRowAddon,
      renderExtensionAddon,
      hideExamples,
      renderRootTreeLines,
      nodeHasChanged,
    ],
  );

  return (
    <MosaicProvider>
      <JSVOptionsContextProvider value={options}>
        <Provider>
          <JsonSchemaViewerInner viewMode={viewMode} skipTopLevelDescription={skipTopLevelDescription} {...rest} />
        </Provider>
      </JSVOptionsContextProvider>
    </MosaicProvider>
  );
};

const JsonSchemaViewerInner = ({
  schema,
  tree,
  viewMode,
  className,
  resolveRef,
  maxRefDepth,
  emptyText = 'No schema defined',
  onTreePopulated,
  maxHeight,
  skipTopLevelDescription,
}: Pick<
  JsonSchemaProps,
  | 'schema'
  | 'tree'
  | 'viewMode'
  | 'className'
  | 'resolveRef'
  | 'maxRefDepth'
  | 'emptyText'
  | 'onTreePopulated'
  | 'maxHeight'
  | 'skipTopLevelDescription'
>) => {
  const setHoveredNode = useSetAtom(hoveredNodeAtom);
  const onMouseLeave = React.useCallback(() => {
    setHoveredNode(null);
  }, [setHoveredNode]);

  // Prefer a pre-populated tree (built off the main thread and cached by React Query).
  // Otherwise build synchronously from `schema` — this covers SSR and the fallback for
  // schemas that weren't prefetched. Building the tree ($ref deref + allOf merge) is
  // the dominant cost, but it's pure and deterministic, so a plain memo suffices; the
  // React Query cache handles reuse across navigations.
  const { root: jsonSchemaTreeRoot, nodeCount } = React.useMemo<PrebuiltSchemaTree>(() => {
    if (tree) return tree;

    const jsonSchemaTree = new JsonSchemaTree(schema, {
      mergeAllOf: true,
      refResolver: resolveRef,
      maxRefDepth,
    });
    let count = 0;
    jsonSchemaTree.walker.hookInto('filter', node => {
      if (shouldNodeBeIncluded(node, viewMode)) {
        count++;
        return true;
      }
      return false;
    });
    jsonSchemaTree.populate();
    return { root: jsonSchemaTree.root, nodeCount: count };
  }, [tree, schema, resolveRef, maxRefDepth, viewMode]);

  React.useEffect(() => {
    onTreePopulated?.({
      rootNode: jsonSchemaTreeRoot,
      nodeCount: nodeCount,
    });
  }, [jsonSchemaTreeRoot, onTreePopulated, nodeCount]);

  const isEmpty = React.useMemo(
    () => jsonSchemaTreeRoot.children.every(node => !isRegularNode(node) || node.unknown),
    [jsonSchemaTreeRoot],
  );

  if (isEmpty) {
    return (
      <Box className={cn(className, 'JsonSchemaViewer')} fontSize="sm" data-test="empty-text">
        {emptyText}
      </Box>
    );
  }

  return (
    <Box
      className={cn('JsonSchemaViewer', className)}
      pos={maxHeight ? 'relative' : undefined}
      overflowY={maxHeight ? 'auto' : undefined}
      onMouseLeave={onMouseLeave}
      style={{ maxHeight }}
    >
      <TopLevelSchemaRow schemaNode={jsonSchemaTreeRoot.children[0]} skipDescription={skipTopLevelDescription} />
    </Box>
  );
};

const JsonSchemaFallbackComponent = ({ error }: FallbackProps) => {
  return (
    <Box p={4}>
      <Box as="b" color="danger">
        Error
      </Box>
      {error !== null ? `: ${error.message}` : null}
    </Box>
  );
};

export const JsonSchemaViewer = withErrorBoundary<JsonSchemaProps>(JsonSchemaViewerComponent, {
  FallbackComponent: JsonSchemaFallbackComponent,
  recoverableProps: ['schema'],
});
