import { isRegularNode, RootNode } from '@postman/json-schema-tree';
import { Box, Provider as MosaicProvider } from '../ui';
import { ErrorBoundaryForwardedProps, FallbackProps, withErrorBoundary } from '@stoplight/react-error-boundary';
import cn from 'classnames';
import { Provider } from 'jotai';
import { useSetAtom } from 'jotai';
import * as React from 'react';

import { JSVOptions, JSVOptionsContextProvider } from '../contexts';
import { TopLevelSchemaRow } from './SchemaRow';
import { hoveredNodeAtom } from './SchemaRow/state';

/** A tree built ahead of time (e.g. on the server, then deserialized). */
export interface PrebuiltSchemaTree {
  root: RootNode;
  nodeCount: number;
}

export type JsonSchemaProps = Partial<JSVOptions> & {
  /**
   * The pre-populated tree to render (see `buildSerializedTree` in ./worker and
   * `deserializeTree`). The viewer never builds a tree itself.
   */
  tree: PrebuiltSchemaTree;
  /**
   * Optional display name for the schema. Accepted for API compatibility with how the
   * upstream npm package was consumed (the app wrapper passes it); it is not used for
   * rendering and is intentionally ignored (dropped via `...rest`).
   */
  name?: string;
  emptyText?: string;
  className?: string;
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
          <JsonSchemaViewerInner skipTopLevelDescription={skipTopLevelDescription} {...rest} />
        </Provider>
      </JSVOptionsContextProvider>
    </MosaicProvider>
  );
};

const JsonSchemaViewerInner = ({
  tree,
  className,
  emptyText = 'No schema defined',
  onTreePopulated,
  maxHeight,
  skipTopLevelDescription,
}: Pick<
  JsonSchemaProps,
  | 'tree'
  | 'className'
  | 'emptyText'
  | 'onTreePopulated'
  | 'maxHeight'
  | 'skipTopLevelDescription'
>) => {
  const setHoveredNode = useSetAtom(hoveredNodeAtom);
  const onMouseLeave = React.useCallback(() => {
    setHoveredNode(null);
  }, [setHoveredNode]);

  const { root: jsonSchemaTreeRoot, nodeCount } = tree;

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
  recoverableProps: ['tree'],
});
