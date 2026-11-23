import { createContext } from 'react';

/** True inside a TabbedPage panel: the page header (breadcrumbs) is already drawn above the tabs. */
export const PanelContext = createContext(false);
