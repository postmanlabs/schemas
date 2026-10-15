/**
 * Interactive controls replacing the Mosaic widgets the viewer used. Select,
 * Menu and Infotip are Base UI primitives (focus, keyboard, aria, outside-dismiss incl. touch
 * handled for us); the rest are plain SSR-friendly elements (`<button>`, `title` tooltips).
 * All are styled with static classes (see styles.css) + Aether tokens — no
 * runtime CSS injection.
 */
import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import * as React from 'react';
import { resolveStyle } from './styleProps';

/* -------------------------------------------------------------------------- */
/* Provider — Mosaic's theme Provider is a no-op here; tokens come from CSS.   */
/* -------------------------------------------------------------------------- */
export const Provider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

/* -------------------------------------------------------------------------- */
/* Link                                                                        */
/* -------------------------------------------------------------------------- */
export const Link = React.forwardRef<HTMLAnchorElement, Record<string, unknown>>(function Link(props, ref) {
  const { style, rest } = resolveStyle(props);
  return <a ref={ref} className="jsv-link" style={{ cursor: 'pointer', ...style }} {...(rest as object)} />;
});

/* -------------------------------------------------------------------------- */
/* Pressable — button-like wrapper that spreads trigger props.                 */
/* -------------------------------------------------------------------------- */
export const Pressable = React.forwardRef<HTMLButtonElement, Record<string, unknown>>(function Pressable(
  { children, ...props },
  ref,
) {
  return (
    <button ref={ref} type="button" className="jsv-pressable" {...(props as object)}>
      {children as React.ReactNode}
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/* Select — Base UI listbox with an optional text prefix.                      */
/* -------------------------------------------------------------------------- */
export interface SelectOption {
  value: string;
  label?: string;
}
export interface SelectProps {
  options: SelectOption[];
  value?: string;
  // Mosaic's Select emitted the option `value` (a string here); typed loosely so
  // callers that index arrays with the result (`value as number`) still type-check.
  onChange?: (value: string | number) => void;
  triggerTextPrefix?: string;
  size?: string;
  // Name of the thing being picked (e.g. the property name). Builds the trigger's
  // accessible name "<label> type, <prefix><current>", which contains the visible
  // text. Without it (and without `aria-label`) the visible text is the name.
  label?: string;
  'aria-label'?: string;
}
export function Select({ options, value, onChange, triggerTextPrefix, label, ...rest }: SelectProps) {
  const current = options.find(opt => opt.value === value) ?? options[0];
  const currentText = current ? (current.label ?? current.value) : '';
  const ariaLabel =
    rest['aria-label'] ??
    (label ? `${label} type${triggerTextPrefix ? `, ${triggerTextPrefix}` : ': '}${currentText}` : undefined);

  return (
    // React synthetic events bubble along the React tree, not the DOM, so clicks
    // inside the portaled popup (incl. Base UI's modal backdrop, which takes the
    // dismissing outside press) still reach the row's expand/collapse onClick
    // that wraps this control. Stop them here, around Root + Portal.
    <span className="jsv-select" onClick={e => e.stopPropagation()}>
      {triggerTextPrefix ? <span className="jsv-select__prefix">{triggerTextPrefix}</span> : null}
      <SelectPrimitive.Root value={current?.value ?? null} onValueChange={v => v != null && onChange?.(v)}>
        <SelectPrimitive.Trigger className="jsv-select__control" aria-label={ariaLabel}>
          {/* Explicit children so the label is in the SSR HTML. */}
          <SelectPrimitive.Value>{currentText}</SelectPrimitive.Value>
          <SelectPrimitive.Icon className="jsv-select__icon">
            <Chevron />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal className="jsv-dropdown-portal">
          <SelectPrimitive.Positioner
            className="jsv-dropdown-positioner"
            alignItemWithTrigger={false}
            side="bottom"
            align="start"
            sideOffset={4}
          >
            <SelectPrimitive.Popup className="jsv-dropdown jsv-dropdown--select">
              <SelectPrimitive.List>
                {options.map(opt => (
                  <SelectPrimitive.Item key={opt.value} value={opt.value} className="jsv-dropdown__item">
                    <SelectPrimitive.ItemIndicator className="jsv-dropdown__indicator">
                      <Check />
                    </SelectPrimitive.ItemIndicator>
                    <SelectPrimitive.ItemText>{opt.label ?? opt.value}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </span>
  );
}

const Chevron = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
    <path d="M1 2.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.25" />
  </svg>
);
const Check = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
    <path d="M1.5 5.25l2.25 2.25 4.75-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/* -------------------------------------------------------------------------- */
/* Menu — Base UI menu.                                                        */
/* -------------------------------------------------------------------------- */
export interface MenuItem {
  id: string | number;
  title: React.ReactNode;
  onPress?: () => void;
}
export interface MenuProps {
  items: MenuItem[];
  // Must return a single element that forwards its ref and spreads props (e.g.
  // Pressable); Base UI wires up the trigger behaviour and aria attributes.
  renderTrigger: () => React.ReactElement;
  closeOnPress?: boolean;
  // Names the menu itself; the trigger is named by its visible text.
  'aria-label'?: string;
  // "<side> <align>", e.g. "bottom left".
  placement?: string;
}
const ALIGN: Record<string, 'start' | 'end'> = { left: 'start', top: 'start', right: 'end', bottom: 'end' };
export function Menu({ items, renderTrigger, closeOnPress = true, placement = 'bottom left', ...rest }: MenuProps) {
  const [side, align] = placement.split(' ') as ['top' | 'right' | 'bottom' | 'left', string | undefined];

  return (
    // See Select: stops React-tree click bubbling from the portaled popup/backdrop.
    <span className="jsv-menu" onClick={e => e.stopPropagation()}>
      <MenuPrimitive.Root>
        <MenuPrimitive.Trigger render={renderTrigger()} />
        <MenuPrimitive.Portal className="jsv-dropdown-portal">
          <MenuPrimitive.Positioner
            className="jsv-dropdown-positioner"
            side={side}
            align={align ? (ALIGN[align] ?? 'center') : 'start'}
            sideOffset={4}
          >
            <MenuPrimitive.Popup
              className="jsv-dropdown"
              // Base UI names the menu after its trigger (aria-labelledby); an
              // explicit label replaces that.
              {...(rest['aria-label'] ? { 'aria-label': rest['aria-label'], 'aria-labelledby': undefined } : null)}
            >
              {items.map(item => (
                <MenuPrimitive.Item
                  key={item.id}
                  className="jsv-dropdown__item"
                  closeOnClick={closeOnPress}
                  onClick={() => item.onPress?.()}
                >
                  {item.title}
                </MenuPrimitive.Item>
              ))}
            </MenuPrimitive.Popup>
          </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
      </MenuPrimitive.Root>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Tooltip — native title tooltip (SSR-safe, no portal/runtime CSS).           */
/* -------------------------------------------------------------------------- */
export interface TooltipProps {
  renderTrigger: React.ReactNode;
  children?: React.ReactNode;
}
export function Tooltip({ renderTrigger, children }: TooltipProps) {
  const title = typeof children === 'string' ? children : undefined;
  return (
    <span className="jsv-tooltip" title={title}>
      {renderTrigger}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Infotip — Base UI Popover that also opens on hover.                        */
/* -------------------------------------------------------------------------- */
export interface InfotipProps {
  // Visible trigger content, e.g. "*".
  trigger: React.ReactNode;
  // Popup text; also the trigger's accessible name, so it's announced once.
  children: string;
  className?: string;
  'data-test'?: string;
}
export function Infotip({ trigger, children, className, ...rest }: InfotipProps) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        className={className}
        aria-label={children}
        // Opens after Base UI's default 300ms hover delay.
        openOnHover
        // Not a tab stop; screen readers still reach it as a button.
        tabIndex={-1}
        {...rest}
      >
        {trigger}
      </PopoverPrimitive.Trigger>
      {/* Nothing is rendered here until it opens, so SSR emits only the trigger. */}
      <PopoverPrimitive.Portal className="jsv-dropdown-portal">
        <PopoverPrimitive.Positioner className="jsv-dropdown-positioner" side="top" sideOffset={4}>
          {/* Keep focus on the trigger; the popup has nothing to interact with. */}
          <PopoverPrimitive.Popup className="jsv-dropdown jsv-infotip" initialFocus={false} finalFocus={false}>
            {children}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------- */
/* NodeAnnotation — diff marker; renders nothing without change data.          */
/* -------------------------------------------------------------------------- */
export interface NodeAnnotationProps {
  // Diff metadata from json-schema-tree; `false`/`undefined` when a node is unchanged
  // (viewer's `nodeHasChanged` returns those), so accept them and render nothing.
  change?: { type?: string; [key: string]: unknown } | false | null;
  style?: React.CSSProperties;
}
export function NodeAnnotation({ change, style }: NodeAnnotationProps) {
  if (!change || !change.type) return null;
  const colorByType: Record<string, string> = {
    added: 'var(--content-color-success)',
    removed: 'var(--content-color-error)',
    modified: 'var(--content-color-warning)',
  };
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        width: 3,
        top: 0,
        bottom: 0,
        borderRadius: 2,
        background: colorByType[change.type] ?? 'var(--border-color-strong)',
        ...style,
      }}
    />
  );
}
