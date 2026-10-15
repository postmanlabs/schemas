import { Icon } from '../../ui';
import * as React from 'react';

import { CARET_ICON_SIZE } from '../../consts';

export interface ICaret {
  isExpanded: boolean;
}

// Styled via `.jsv-caret` (styles.css) rather than inline styles so the row
// toggle's :hover/:focus-visible rules can recolour it.
export const Caret: React.FunctionComponent<ICaret> = ({ isExpanded }) => (
  <span className="jsv-caret">
    <Icon size={CARET_ICON_SIZE} fixedWidth icon={isExpanded ? 'chevron-down' : 'chevron-right'} />
  </span>
);
