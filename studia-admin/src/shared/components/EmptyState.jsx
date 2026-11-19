import mascot from '../../assets/studia-mascot.png';

/**
 * The one empty state in the app: mascot, a title, a line of help and an
 * optional action. Use it for "nothing here yet", "no results" and errors.
 */
export default function EmptyState({
  title,
  message,
  action,
  tone = 'empty',
  compact = false,
  headingLevel = 3,
}) {
  // On the 404/403 pages this state IS the page, so it carries the only <h1>;
  // inside a card it stays an <h3> under the page's own heading.
  const Heading = `h${headingLevel}`;
  return (
    <div className={`empty-state ${compact ? 'compact' : ''} empty-${tone}`} role="status">
      <img src={mascot} alt="" aria-hidden="true" className="empty-mascot" />
      <Heading>{title}</Heading>
      {message && <p className="muted">{message}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
