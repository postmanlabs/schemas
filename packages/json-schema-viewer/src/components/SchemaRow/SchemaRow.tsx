import { isMirroredNode, isReferenceNode, isRegularNode, SchemaNode } from '@postman/json-schema-tree';
import { Box, Flex, Infotip, NodeAnnotation, Select, SpaceVals, VStack } from '../../ui';
import type { ChangeType } from '@stoplight/types';
import { Atom, useAtomValue, useSetAtom } from 'jotai';
import { last } from '../../lodashLite';
import * as React from 'react';

import { COMBINER_NAME_MAP } from '../../consts';
import { useJSVOptionsContext } from '../../contexts';
import { getNodeId, getOriginalNodeId } from '../../hash';
import { isComplexArray, isNonEmptyParentNode, isPropertyRequired, visibleChildren } from '../../tree';
import { extractVendorExtensions } from '../../utils/extractVendorExtensions';
import { Caret, Description, getValidationsFromSchema, Types, Validations } from '../shared';
import { ChildStack } from '../shared/ChildStack';
import { Error } from '../shared/Error';
import { Properties, useHasProperties } from '../shared/Properties';
import { hoveredNodeAtom, isNodeHoveredAtom } from './state';
import { useChoices } from './useChoices';

export interface SchemaRowProps {
  schemaNode: SchemaNode;
  nestingLevel: number;
  pl?: SpaceVals;
  parentNodeId?: string;
  parentChangeType?: ChangeType;
}

export const SchemaRow: React.FunctionComponent<SchemaRowProps> = React.memo(
  ({ schemaNode, nestingLevel, pl, parentNodeId, parentChangeType }) => {
    const {
      defaultExpandedDepth,
      renderRowAddon,
      renderExtensionAddon,
      onGoToRef,
      hideExamples,
      renderRootTreeLines,
      nodeHasChanged,
      viewMode,
    } = useJSVOptionsContext();

    const setHoveredNode = useSetAtom(hoveredNodeAtom);

    const nodeId = getNodeId(schemaNode, parentNodeId);

    // @ts-expect-error originalFragment does exist...
    const originalNodeId = schemaNode.originalFragment?.$ref ? getOriginalNodeId(schemaNode, parentNodeId) : nodeId;
    const mode = viewMode === 'standalone' ? undefined : viewMode;
    const hasChanged = nodeHasChanged?.({ nodeId: originalNodeId, mode });

    const [isExpanded, setExpanded] = React.useState<boolean>(
      !isMirroredNode(schemaNode) && nestingLevel <= defaultExpandedDepth,
    );

    const { selectedChoice, setSelectedChoice, choices } = useChoices(schemaNode);
    const typeToShow = selectedChoice.type;
    // A oneOf/anyOf choice (incl. a flattened array-of-oneOf) replaces the node
    // shown, so keep the property's own description and add the selected
    // variant's only when it says something different.
    const ownDescription = isRegularNode(schemaNode) ? schemaNode.annotations.description : null;
    const choiceDescription =
      typeToShow !== schemaNode && isRegularNode(typeToShow) ? typeToShow.annotations.description : null;

    const rootLevel = renderRootTreeLines ? 1 : 2;
    const childNodes = React.useMemo(() => visibleChildren(typeToShow), [typeToShow]);
    // An array whose items are a combiner is flattened into per-variant choices
    // (see useChoices); surface that combiner on the trigger so the options stay
    // bare titles instead of each repeating "array (oneOf) [...]".
    const arrayCombinerChild =
      isComplexArray(schemaNode) &&
      isNonEmptyParentNode(schemaNode.children[0]) &&
      schemaNode.children[0].combiners?.length
        ? schemaNode.children[0]
        : null;
    const combiner =
      isRegularNode(schemaNode) && schemaNode.combiners?.length
        ? schemaNode.combiners[0]
        : (arrayCombinerChild?.combiners?.[0] ?? null);
    const isCollapsible = childNodes.length > 0;
    const isRootLevel = nestingLevel < rootLevel;

    const required = isPropertyRequired(schemaNode);
    const deprecated = isRegularNode(schemaNode) && schemaNode.deprecated;
    const validations = isRegularNode(schemaNode) ? schemaNode.validations : {};
    const hasProperties = useHasProperties({ deprecated, validations });

    const [totalVendorExtensions, vendorExtensions] = React.useMemo(
      () => extractVendorExtensions(schemaNode.fragment),
      [schemaNode.fragment],
    );
    const hasVendorProperties = totalVendorExtensions > 0;

    const annotationRootOffset = renderRootTreeLines ? 0 : 8;
    let annotationLeftOffset = -20 - annotationRootOffset;
    if (nestingLevel > 1) {
      // annotationLeftOffset -= 27;
      annotationLeftOffset =
        -1 * 29 * Math.max(nestingLevel - 1, 1) - Math.min(nestingLevel, 2) * 2 - 16 - annotationRootOffset;

      if (!renderRootTreeLines) {
        annotationLeftOffset += 27;
      }
    }

    const showName = schemaNode.subpath.length > 0 && shouldShowPropertyName(schemaNode);
    // The row toggle holds only the caret + name; everything else follows it.
    const name = showName && (
      <Box
        as="span"
        // Trailing gap comes from styles.css (--jsv-name-gap) on every row kind.
        className="jsv-property-name"
        fontFamily="mono"
        fontWeight="semibold"
        data-test={`property-name-${last(schemaNode.subpath)}`}
      >
        {last(schemaNode.subpath)}
      </Box>
    );
    const afterName = (
      <>
        {showName && required && (
          <Infotip className="jsv-required" data-test="property-required" trigger={<span aria-hidden="true">*</span>}>
            required
          </Infotip>
        )}
        {choices.length === 1 && <Types schemaNode={typeToShow} />}
      </>
    );

    if (parentChangeType === 'added' && hasChanged && hasChanged.type === 'removed') {
      return null;
    }

    if (parentChangeType === 'removed' && hasChanged && hasChanged.type === 'added') {
      return null;
    }

    return (
      <>
        <Flex
          maxW="full"
          pl={pl}
          py={2}
          data-id={originalNodeId}
          data-test="schema-row"
          pos="relative"
          onMouseEnter={(e: any) => {
            e.stopPropagation();
            setHoveredNode(selectedChoice.type);
          }}
        >
          {!isRootLevel && <Box borderT w={isCollapsible ? 1 : 3} ml={-3} mr={3} mt={2} />}
          {parentChangeType !== 'added' && parentChangeType !== 'removed' ? (
            <NodeAnnotation change={hasChanged} style={{ left: annotationLeftOffset }} />
          ) : null}
          <VStack spacing={1} maxW="full" flex={1} ml={isCollapsible && !isRootLevel ? 2 : undefined}>
            <Flex alignItems="center" maxW="full">
              {/* minW 0 lets a long type title ellipsize instead of widening the page on phones. */}
              <Flex alignItems="baseline" fontSize="base" minW={0}>
                {isCollapsible ? (
                  // Only the caret + name toggles the row; the rest of the row (required
                  // infotip, type, type select, divider, validations) is not a click target.
                  <span
                    className="jsv-row-toggle"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    // Caret-only toggle (no name): give it a name.
                    aria-label={showName ? undefined : isExpanded ? 'Collapse' : 'Expand'}
                    onClick={() => setExpanded(!isExpanded)}
                    onKeyDown={e => {
                      // Modified arrows (Alt+← Back, Shift+← selection, ...) stay with the browser.
                      const modified = e.altKey || e.ctrlKey || e.metaKey || e.shiftKey;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        // Holding the key must not keep flipping the row.
                        if (!e.repeat) setExpanded(!isExpanded);
                      } else if (e.key === 'ArrowRight' && !modified && !isExpanded) {
                        e.preventDefault();
                        setExpanded(true);
                      } else if (e.key === 'ArrowLeft' && !modified && isExpanded) {
                        e.preventDefault();
                        setExpanded(false);
                      }
                    }}
                  >
                    <Caret isExpanded={isExpanded} />
                    {name}
                  </span>
                ) : (
                  name
                )}
                {afterName}

                {onGoToRef && isReferenceNode(schemaNode) && schemaNode.external ? (
                  <Box
                    as="a"
                    ml={2}
                    cursor="pointer"
                    color="primary-light"
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onGoToRef(schemaNode);
                    }}
                  >
                    (go to ref)
                  </Box>
                ) : null}

                {schemaNode.subpath.length > 1 && schemaNode.subpath[0] === 'patternProperties' ? (
                  <Box ml={2} color="muted">
                    (pattern property)
                  </Box>
                ) : null}

                {choices.length > 1 && (
                  <Select
                    label={shouldShowPropertyName(schemaNode) ? last(schemaNode.subpath) : undefined}
                    size="sm"
                    triggerTextPrefix={
                      combiner
                        ? `${arrayCombinerChild ? 'array ' : ''}${COMBINER_NAME_MAP[combiner]}: `
                        : undefined
                    }
                    options={choices.map((choice, index) => ({
                      value: String(index),
                      label: choice.title,
                    }))}
                    value={
                      String(choices.indexOf(selectedChoice))
                      /* String to work around https://github.com/stoplightio/mosaic/issues/162 */
                    }
                    onChange={selectedIndex => setSelectedChoice(choices[selectedIndex as number])}
                  />
                )}
              </Flex>
              {hasProperties && <Divider atom={isNodeHoveredAtom(schemaNode)} />}
              <Properties deprecated={deprecated} validations={validations} />
            </Flex>
            {[ownDescription, choiceDescription !== ownDescription ? choiceDescription : null].map(
              (description, index) =>
                typeof description === 'string' &&
                (!combiner || schemaNode.parent?.fragment.description !== description) &&
                description.length > 0 && <Description key={index} value={description} />,
            )}
            <Validations
              validations={isRegularNode(schemaNode) ? getValidationsFromSchema(schemaNode) : {}}
              hideExamples={hideExamples}
            />
            {hasVendorProperties && renderExtensionAddon ? (
              <Box>{renderExtensionAddon({ schemaNode, nestingLevel, vendorExtensions })}</Box>
            ) : null}
          </VStack>
          <Error schemaNode={schemaNode} />
          {renderRowAddon ? <Box>{renderRowAddon({ schemaNode, nestingLevel })}</Box> : null}
        </Flex>
        {isCollapsible && isExpanded ? (
          <ChildStack
            schemaNode={schemaNode}
            childNodes={childNodes}
            currentNestingLevel={nestingLevel}
            parentNodeId={nodeId}
            parentChangeType={parentChangeType ? parentChangeType : hasChanged ? hasChanged?.type : undefined}
          />
        ) : null}
      </>
    );
  },
);

const Divider = ({ atom }: { atom: Atom<boolean> }) => {
  const isHovering = useAtomValue(atom);

  return <Box bg={isHovering ? 'canvas-200' : undefined} h="px" flex={1} mx={3} />;
};

function shouldShowPropertyName(schemaNode: SchemaNode) {
  return (
    schemaNode.subpath.length === 2 &&
    (schemaNode.subpath[0] === 'properties' || schemaNode.subpath[0] === 'patternProperties')
  );
}
