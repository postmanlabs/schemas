/**
 * Tiny inline-SVG icon set replacing Mosaic's FontAwesome-backed `Icon`. Only the
 * handful of glyphs the viewer actually uses are included; they draw with
 * `currentColor` so callers control color via the surrounding text color.
 */
import * as React from 'react';

export type IconName = string | readonly string[];

/** Normalize Mosaic's `icon` prop (string or [prefix, name] tuple) to a glyph key. */
function iconKey(icon: IconName): string {
  return Array.isArray(icon) ? icon[icon.length - 1] : (icon as string);
}

const SIZE: Record<string, string> = {
  xs: '0.625rem',
  sm: '0.75rem',
  base: '0.875rem',
  lg: '1.25em',
  '1x': '1em',
  '2x': '2em',
};

function resolveSize(size: string | number | undefined): string {
  if (size == null) return '1em';
  if (typeof size === 'number') return `${size}px`;
  return SIZE[size] ?? size;
}

/**
 * `square` glyphs always render in a square box (ignoring `fixedWidth`). The
 * chevrons need it: chevron-down is chevron-right rotated 90deg about the
 * viewBox centre, so in a square box both states have the same layout box.
 */
const GLYPHS: Record<string, { viewBox: string; node: React.ReactNode; square?: boolean }> = {
  'chevron-down': {
    viewBox: '0 0 16 16',
    square: true,
    node: (
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  'chevron-right': {
    viewBox: '0 0 16 16',
    square: true,
    node: (
      <path
        d="M6 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  'caret-down': {
    viewBox: '0 0 16 16',
    node: <path d="M4 6h8l-4 5z" fill="currentColor" />,
  },
  'exclamation-triangle': {
    viewBox: '0 0 16 16',
    node: (
      <g fill="currentColor">
        <path d="M7.13 2.2a1 1 0 0 1 1.74 0l5.7 10.05A1 1 0 0 1 13.7 13.8H2.3a1 1 0 0 1-.87-1.55L7.13 2.2z" opacity="0.15" />
        <path d="M7.13 2.2a1 1 0 0 1 1.74 0l5.7 10.05A1 1 0 0 1 13.7 13.8H2.3a1 1 0 0 1-.87-1.55L7.13 2.2zm.87 1.3L3.1 12.3h9.8L8 3.5z" />
        <path d="M7.25 6h1.5v3.5h-1.5zM7.25 10.5h1.5V12h-1.5z" />
      </g>
    ),
  },
};

export interface IconProps {
  icon: IconName;
  size?: string | number;
  fixedWidth?: boolean;
  color?: string;
  'aria-label'?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ icon, size, fixedWidth, color, className, style, ...rest }: IconProps) {
  const key = iconKey(icon);
  const glyph = GLYPHS[key];
  const dim = resolveSize(size);
  if (!glyph) return null;
  return (
    <svg
      className={className}
      viewBox={glyph.viewBox}
      width={fixedWidth && !glyph.square ? '1.25em' : dim}
      height={dim}
      role="img"
      aria-hidden={rest['aria-label'] ? undefined : true}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, color, ...style }}
      {...rest}
    >
      {glyph.node}
    </svg>
  );
}
