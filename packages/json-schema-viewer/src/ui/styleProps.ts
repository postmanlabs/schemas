/**
 * Translates the small subset of Mosaic's atomic style props used by the viewer
 * into plain inline-style objects backed by Aether design tokens.
 *
 * Why inline styles: Mosaic styled its components by injecting CSS at runtime
 * (styled-components/emotion). Under SSR that CSS isn't present in the server HTML,
 * so the viewer rendered unstyled for a beat and "snapped" into place on hydration.
 * Inline styles are serialized into the SSR markup itself, so the first paint is
 * already styled — no runtime injection, no flash.
 */
import type { CSSProperties } from 'react';

export type SpaceVals = number | string;

/** Mosaic's Tailwind-like spacing scale (rem), keyed by the numeric/string token. */
const SPACE: Record<string, string> = {
  '0': '0',
  px: '1px',
  '0.5': '0.125rem',
  '1': '0.25rem',
  '1.5': '0.375rem',
  '2': '0.5rem',
  '2.5': '0.625rem',
  '3': '0.75rem',
  '3.5': '0.875rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '7': '1.75rem',
  '8': '2rem',
  '9': '2.25rem',
  '10': '2.5rem',
  '12': '3rem',
};

/** Resolve a spacing token to a CSS length, supporting negatives (e.g. ml={-8}). */
export function space(v: SpaceVals | undefined): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') {
    if (v < 0) {
      const base = SPACE[String(-v)];
      return base ? `-${base}` : `${v * 0.25}rem`;
    }
    return SPACE[String(v)] ?? `${v * 0.25}rem`;
  }
  return SPACE[v] ?? v;
}

/** A few named t-shirt sizes Mosaic uses for width/height. */
const NAMED_SIZE: Record<string, string> = {
  xs: '1rem',
  sm: '1.25rem',
  md: '1.5rem',
  lg: '2rem',
  xl: '2.5rem',
};

/** Sizing tokens reuse the spacing scale but also accept `full`/`auto`/named sizes. */
function size(v: SpaceVals | undefined): string | undefined {
  if (v == null) return undefined;
  if (v === 'full') return '100%';
  if (v === 'auto') return 'auto';
  if (typeof v === 'string' && NAMED_SIZE[v]) return NAMED_SIZE[v];
  return space(v);
}

const LINE_HEIGHT: Record<string, string | number> = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
};

const FONT_SIZE: Record<string, string> = {
  xs: '0.6875rem',
  sm: '0.75rem',
  base: '0.875rem',
  md: '0.875rem',
  lg: '1rem',
  xl: '1.25rem',
};

const FONT_WEIGHT: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

const FONT_FAMILY: Record<string, string> = {
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  sans: 'inherit',
};

/** Map Mosaic color intents to Aether content-color tokens; pass raw CSS through. */
export function color(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const map: Record<string, string> = {
    body: 'var(--content-color-primary)',
    muted: 'var(--content-color-tertiary)',
    light: 'var(--content-color-tertiary)',
    primary: 'var(--content-color-link)',
    'primary-light': 'var(--content-color-link)',
    danger: 'var(--content-color-error)',
    warning: 'var(--content-color-warning)',
    success: 'var(--content-color-success)',
    info: 'var(--content-color-info)',
  };
  if (map[v]) return map[v];
  // Already a CSS value (var(...)/#hex/rgb/named) — use as-is.
  return v;
}

/** Map Mosaic background intents to Aether background-color tokens. */
function bg(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const map: Record<string, string> = {
    canvas: 'var(--background-color-primary)',
    'canvas-pure': 'var(--background-color-primary)',
    'canvas-50': 'var(--background-color-secondary)',
    'canvas-100': 'var(--background-color-secondary)',
    'canvas-200': 'var(--background-color-tertiary)',
    'canvas-tint': 'var(--background-color-secondary)',
  };
  return map[v] ?? v;
}

const BORDER = '1px solid var(--border-color-default)';

/**
 * The full set of Mosaic-ish style props the viewer passes. Everything is optional;
 * anything not recognized here falls through untouched to the host element.
 */
export interface StyleProps {
  // spacing
  p?: SpaceVals; px?: SpaceVals; py?: SpaceVals;
  pt?: SpaceVals; pr?: SpaceVals; pb?: SpaceVals; pl?: SpaceVals;
  m?: SpaceVals; mx?: SpaceVals; my?: SpaceVals;
  mt?: SpaceVals; mr?: SpaceVals; mb?: SpaceVals; ml?: SpaceVals;
  // sizing
  w?: SpaceVals; h?: SpaceVals; maxW?: SpaceVals; maxH?: SpaceVals; minW?: SpaceVals;
  flex?: number | string; flexWrap?: boolean;
  // color
  color?: string; bg?: string;
  // border
  border?: boolean; borderT?: boolean; borderB?: boolean; borderL?: boolean; borderR?: boolean;
  rounded?: boolean | string;
  // typography
  fontSize?: string; fontFamily?: string; fontWeight?: string;
  textOverflow?: 'truncate' | string; wordBreak?: 'all' | string;
  // layout
  pos?: CSSProperties['position']; display?: CSSProperties['display'];
  overflowX?: CSSProperties['overflowX']; overflowY?: CSSProperties['overflowY'];
  alignItems?: CSSProperties['alignItems']; justifyContent?: CSSProperties['justifyContent'];
  cursor?: CSSProperties['cursor'];
  top?: SpaceVals; right?: SpaceVals; bottom?: SpaceVals; left?: SpaceVals;
  zIndex?: number;
  lineHeight?: string | number;
  // stack gap (HStack/VStack)
  spacing?: SpaceVals;
}

const STYLE_KEYS: (keyof StyleProps)[] = [
  'p','px','py','pt','pr','pb','pl','m','mx','my','mt','mr','mb','ml',
  'w','h','maxW','maxH','minW','flex','flexWrap','color','bg','border','borderT','borderB','borderL','borderR','rounded',
  'fontSize','fontFamily','fontWeight','textOverflow','wordBreak','pos','display','overflowX','overflowY',
  'alignItems','justifyContent','cursor','top','right','bottom','left','zIndex','lineHeight','spacing',
];

/**
 * Split a props object into a computed inline `style` and the remaining DOM props.
 * A caller-provided `style` is merged last so it can override.
 */
export function resolveStyle<T extends Record<string, unknown>>(
  props: T,
): { style: CSSProperties; rest: Omit<T, keyof StyleProps | 'style'> } {
  const p = props as StyleProps & { style?: CSSProperties };
  const s: CSSProperties = {};

  // padding
  if (p.p != null) s.padding = space(p.p);
  if (p.px != null) { s.paddingLeft = space(p.px); s.paddingRight = space(p.px); }
  if (p.py != null) { s.paddingTop = space(p.py); s.paddingBottom = space(p.py); }
  if (p.pt != null) s.paddingTop = space(p.pt);
  if (p.pr != null) s.paddingRight = space(p.pr);
  if (p.pb != null) s.paddingBottom = space(p.pb);
  if (p.pl != null) s.paddingLeft = space(p.pl);
  // margin
  if (p.m != null) s.margin = space(p.m);
  if (p.mx != null) { s.marginLeft = space(p.mx); s.marginRight = space(p.mx); }
  if (p.my != null) { s.marginTop = space(p.my); s.marginBottom = space(p.my); }
  if (p.mt != null) s.marginTop = space(p.mt);
  if (p.mr != null) s.marginRight = space(p.mr);
  if (p.mb != null) s.marginBottom = space(p.mb);
  if (p.ml != null) s.marginLeft = space(p.ml);
  // sizing
  if (p.w != null) s.width = size(p.w);
  if (p.h != null) s.height = size(p.h);
  if (p.maxW != null) s.maxWidth = size(p.maxW);
  if (p.maxH != null) s.maxHeight = size(p.maxH);
  if (p.minW != null) s.minWidth = size(p.minW);
  if (p.flex != null) s.flex = p.flex;
  if (p.flexWrap) s.flexWrap = 'wrap';
  // color
  if (p.color != null) s.color = color(p.color);
  if (p.bg != null) s.background = bg(p.bg);
  // border
  if (p.border) s.border = BORDER;
  if (p.borderT) s.borderTop = BORDER;
  if (p.borderB) s.borderBottom = BORDER;
  if (p.borderL) s.borderLeft = BORDER;
  if (p.borderR) s.borderRight = BORDER;
  if (p.rounded) s.borderRadius = typeof p.rounded === 'string' ? p.rounded : '3px';
  // typography
  if (p.fontSize != null) s.fontSize = FONT_SIZE[p.fontSize] ?? p.fontSize;
  if (p.fontFamily != null) s.fontFamily = FONT_FAMILY[p.fontFamily] ?? p.fontFamily;
  if (p.fontWeight != null) s.fontWeight = FONT_WEIGHT[p.fontWeight] ?? (p.fontWeight as unknown as number);
  if (p.textOverflow === 'truncate') { s.overflow = 'hidden'; s.textOverflow = 'ellipsis'; s.whiteSpace = 'nowrap'; }
  else if (p.textOverflow != null) s.textOverflow = p.textOverflow;
  if (p.wordBreak === 'all') s.wordBreak = 'break-all';
  else if (p.wordBreak != null) s.wordBreak = p.wordBreak as CSSProperties['wordBreak'];
  // layout
  if (p.pos != null) s.position = p.pos;
  if (p.display != null) s.display = p.display;
  if (p.overflowX != null) s.overflowX = p.overflowX;
  if (p.overflowY != null) s.overflowY = p.overflowY;
  if (p.alignItems != null) s.alignItems = p.alignItems;
  if (p.justifyContent != null) s.justifyContent = p.justifyContent;
  if (p.cursor != null) s.cursor = p.cursor;
  if (p.top != null) s.top = space(p.top);
  if (p.right != null) s.right = space(p.right);
  if (p.bottom != null) s.bottom = space(p.bottom);
  if (p.left != null) s.left = space(p.left);
  if (p.zIndex != null) s.zIndex = p.zIndex;
  if (p.lineHeight != null) s.lineHeight = typeof p.lineHeight === 'string' ? (LINE_HEIGHT[p.lineHeight] ?? p.lineHeight) : p.lineHeight;

  const rest: Record<string, unknown> = {};
  const styleKeySet = new Set<string>(STYLE_KEYS as string[]);
  for (const key of Object.keys(props)) {
    if (styleKeySet.has(key) || key === 'style') continue;
    rest[key] = props[key];
  }

  return { style: { ...s, ...(p.style ?? {}) }, rest: rest as Omit<T, keyof StyleProps | 'style'> };
}
