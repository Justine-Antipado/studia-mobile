import { useLocation } from 'react-router-dom';
import { findPage } from '../../core/config/navigation';
import EmptyState from './EmptyState';
import PageHeader from './PageHeader';

/**
 * SCAFFOLDING — a real page with the final header, title and breadcrumbs, but
 * no content yet. It exists so the shell (routing, navigation, breadcrumbs,
 * transitions, document titles) can be finished and tested in phase 1 before
 * the feature pages are built.
 *
 * Each later phase replaces these files one by one; delete this component once
 * the last one is gone.
 */
export default function ComingSoon({ phase, note }) {
  const { pathname } = useLocation();
  const page = findPage(pathname);

  return (
    <>
      <PageHeader title={page?.title ?? 'Page'} subtitle={page?.description} />
      <EmptyState
        title="Not built yet"
        message={note ?? `This screen is scheduled for ${phase ?? 'a later phase'}. The route, navigation, breadcrumbs and page title are already final.`}
      />
    </>
  );
}
