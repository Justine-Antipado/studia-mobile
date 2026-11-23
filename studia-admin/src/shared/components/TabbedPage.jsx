import { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from './PageHeader';
import { PanelContext } from './panelContext';
import { Skeleton } from './Skeleton';
import Tabs from './Tabs';

/**
 * One page, several tabs (Announcements, Security, Settings): the sidebar has a single entry and the
 * sections live in the page itself, selected by `?tab=`. The first tab is the default and has no
 * query string. Each tab is `{ key, label, component }`; components may be lazy, and render their own
 * content (their PageHeader collapses to just its actions, see PageHeader).
 *
 * Switching tabs starts the next one clean: its search, sort and page are not carried over.
 */
export default function TabbedPage({ tabs, 'aria-label': ariaLabel }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active = tabs.find((t) => t.key === requested) ?? tabs[0];
  const Panel = active.component;
  const switchTab = (key) => setParams(key === tabs[0].key ? {} : { tab: key });

  return (
    <>
      <PageHeader />
      <Tabs
        items={tabs.map(({ key, label }) => ({ key, label }))}
        value={active.key}
        onChange={switchTab}
        controls="tabbed-panel"
        aria-label={ariaLabel}
      />
      <div id="tabbed-panel" role="tabpanel" aria-labelledby={`tab-${active.key}`} key={active.key}>
        <PanelContext.Provider value>
          <Suspense fallback={<Skeleton height={320} radius="var(--radius-lg)" />}>
            <Panel />
          </Suspense>
        </PanelContext.Provider>
      </div>
    </>
  );
}
