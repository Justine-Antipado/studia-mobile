import { Component } from 'react';
import EmptyState from './EmptyState';

/**
 * Catches render-time crashes so one broken page cannot blank the portal.
 * App.jsx mounts one around the whole app and one per route, keyed on the
 * pathname, so navigating away clears the error.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Replace with a real error sink (Sentry, PHP /api/admin/client-errors) later.
    console.error('[studia-admin] render error', error, info?.componentStack);
  }

  retry() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    const { children, title = 'This page could not be displayed', fallback } = this.props;
    if (!error) return children;
    if (fallback) return fallback(error, this.retry);

    return (
      <EmptyState
        tone="error"
        title={title}
        message="Something in the page failed to render. Reloading usually fixes it; if it keeps happening, report it with the time it occurred."
        action={
          <div className="empty-buttons">
            <button type="button" className="btn btn-primary" onClick={this.retry}>
              Try again
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>
              Reload the portal
            </button>
          </div>
        }
      />
    );
  }
}
