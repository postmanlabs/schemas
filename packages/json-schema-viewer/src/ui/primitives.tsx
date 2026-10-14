/**
 * Minimal layout/typography primitives that stand in for the Mosaic components the
 * viewer used (`Box`, `Flex`, `HStack`, `VStack`, `Text`). They render plain DOM
 * elements with computed inline styles (see styleProps.ts) so everything is fully
 * styled in the SSR HTML with no runtime CSS injection.
 */
import * as React from 'react';
import { resolveStyle, space, type SpaceVals, type StyleProps } from './styleProps';

// Own props plus a permissive bag for arbitrary DOM attributes (data-*, aria-*,
// event handlers, role, etc.) that the viewer passes through. `Record<string, any>`
// (rather than an `unknown` index signature) keeps the explicit props' types intact.
type AnyProps = StyleProps &
  Record<string, any> & {
    as?: React.ElementType;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  };

export const Box = React.forwardRef<HTMLElement, AnyProps>(function Box(
  { as: Component = 'div', children, ...props },
  ref,
) {
  const { style, rest } = resolveStyle(props);
  return (
    <Component ref={ref} style={style} {...rest}>
      {children}
    </Component>
  );
});

export const Flex = React.forwardRef<HTMLElement, AnyProps>(function Flex(
  { as: Component = 'div', children, style: styleProp, ...props },
  ref,
) {
  const { style, rest } = resolveStyle({ ...props, style: styleProp });
  return (
    <Component ref={ref} style={{ display: 'flex', ...style }} {...rest}>
      {children}
    </Component>
  );
});

type StackProps = AnyProps & { spacing?: SpaceVals; divider?: React.ReactNode };

/** Interleave a divider node between each child (Mosaic HStack/VStack `divider`). */
function withDividers(children: React.ReactNode, divider: React.ReactNode): React.ReactNode {
  const items = React.Children.toArray(children);
  return items.map((child, i) => (
    <React.Fragment key={i}>
      {i > 0 ? <React.Fragment>{divider}</React.Fragment> : null}
      {child}
    </React.Fragment>
  ));
}

function makeStack(direction: 'row' | 'column') {
  return React.forwardRef<HTMLElement, StackProps>(function Stack(
    { as: Component = 'div', children, spacing, divider, style: styleProp, ...props },
    ref,
  ) {
    const { style, rest } = resolveStyle({ ...props, style: styleProp });
    return (
      <Component
        ref={ref}
        style={{
          display: 'flex',
          flexDirection: direction,
          alignItems: direction === 'row' ? 'center' : undefined,
          gap: space(spacing),
          ...style,
        }}
        {...rest}
      >
        {divider != null ? withDividers(children, divider) : children}
      </Component>
    );
  });
}

export const HStack = makeStack('row');
export const VStack = makeStack('column');

export const Text = React.forwardRef<HTMLElement, AnyProps>(function Text(
  { as: Component = 'span', children, ...props },
  ref,
) {
  const { style, rest } = resolveStyle(props);
  return (
    <Component ref={ref} style={style} {...rest}>
      {children}
    </Component>
  );
});
