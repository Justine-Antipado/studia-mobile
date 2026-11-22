import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_GROUPS, activeItemFor } from '../../core/config/navigation';
import { Icon, getIcon } from './Icon';
import { Avatar } from './ui';
import omsuLogo from '../../assets/omsu-logo.png';
import studiaLogo from '../../assets/studia-logo.png';

/** Real sub-pages only: templates with a :param are detail routes, not menu entries. */
const subPagesOf = (item) => item.children?.filter((c) => !c.path.includes(':')) ?? [];

/**
 * Grouped navigation, driven entirely by core/config/navigation.js.
 * Always fully expanded on desktop, an off-canvas drawer under 1024px.
 * Items with sub-pages (Security, Settings) are accordion sections that
 * expand and collapse on every click.
 */
export default function Sidebar({ open, counts = {}, admin, onNavigate, onLogout }) {
  const { pathname } = useLocation();
  const activePath = activeItemFor(pathname);

  // Which expandable section owns the current route — that one starts open.
  const routeSection = useMemo(() => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (subPagesOf(item).length === 0) continue;
        if (activePath === item.path || pathname.startsWith(item.path + '/')) return item.path;
      }
    }
    return null;
  }, [activePath, pathname]);

  // `choice === undefined` means "follow the route". A manual toggle stores the
  // section it was made on, so it sticks until the user navigates elsewhere.
  const [choice, setChoice] = useState({ on: null, value: undefined });
  const expanded = choice.on === routeSection && choice.value !== undefined ? choice.value : routeSection;

  const toggleSection = useCallback(
    (path) => setChoice({ on: routeSection, value: expanded === path ? null : path }),
    [expanded, routeSection]
  );

  // The account menu remembers which page it was opened on, so any navigation
  // closes it without an effect — including Back and Forward.
  const [openedOn, setOpenedOn] = useState(null);
  const menuOpen = openedOn === pathname;
  const setMenuOpen = useCallback((next) => setOpenedOn(next ? pathname : null), [pathname]);
  const menuRef = useRef(null);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => !menuRef.current?.contains(e.target) && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen, setMenuOpen]);

  // Opening the menu moves focus onto its first item, so it is reachable
  // without a mouse; Escape closes it and returns focus to the button.
  useEffect(() => {
    if (!menuOpen) return undefined;
    panelRef.current?.querySelector('[role="menuitem"]')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen, setMenuOpen]);

  // Up/Down cycle through the items, Home/End jump to the ends.
  const onMenuKeyDown = (e) => {
    const items = [...(panelRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement);
    const next = {
      ArrowDown: () => (index + 1) % items.length,
      ArrowUp: () => (index <= 0 ? items.length - 1 : index - 1),
      Home: () => 0,
      End: () => items.length - 1,
    }[e.key];
    if (!next) return;
    e.preventDefault();
    items[next()].focus();
  };

  return (
    <aside id="sidebar" className={'sidebar ' + (open ? 'open' : '')} aria-label="Portal navigation">
      <div className="sidebar-top">
        <div className="sidebar-logos">
          <img src={omsuLogo} alt="OMSU seal" />
          <img src={studiaLogo} alt="STUDIA" />
        </div>
      </div>

      <nav className="sidebar-nav no-scrollbar" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.id}>
            <p className="nav-group-label">{group.label}</p>
            <ul>
              {group.items.map((item) => {
                const IconCmp = getIcon(item.icon);
                const isActive = activePath === item.path;
                const badge = item.badge ? counts[item.badge] : 0;
                const children = subPagesOf(item);
                const isSection = children.length > 0;
                const isOpen = isSection && expanded === item.path;
                const panelId = 'nav-sub-' + item.path.replace(/\W+/g, '-');

                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={() => {
                        if (isSection) toggleSection(item.path);
                        onNavigate?.();
                      }}
                      onKeyDown={(e) => {
                        // Enter follows the link (and toggles through onClick);
                        // Space toggles without leaving the page.
                        if (isSection && e.key === ' ') {
                          e.preventDefault();
                          toggleSection(item.path);
                        }
                      }}
                      className={
                        'nav-item' + (isActive ? ' active' : '') + (isSection ? ' nav-item-parent' : '')
                      }
                      aria-current={isActive ? 'page' : undefined}
                      aria-expanded={isSection ? isOpen : undefined}
                      aria-controls={isSection ? panelId : undefined}
                    >
                      <span className="nav-icon">
                        <IconCmp />
                      </span>
                      <span className="nav-label">{item.label}</span>
                      {badge > 0 && <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>}
                      {isSection && (
                        <span className={'nav-chevron' + (isOpen ? ' open' : '')} aria-hidden="true">
                          <Icon.ChevronDown />
                        </span>
                      )}
                    </NavLink>

                    {isSection && (
                      <div className={'nav-sub-wrap' + (isOpen ? ' open' : '')} id={panelId}>
                        <ul className="nav-sub">
                          {children.map((child) => (
                            <li key={child.path}>
                              <NavLink
                                to={child.path}
                                onClick={onNavigate}
                                tabIndex={isOpen ? undefined : -1}
                                className={({ isActive: on }) => 'nav-subitem ' + (on ? 'active' : '')}
                              >
                                {child.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-user" ref={menuRef}>
        {menuOpen && (
          <div
            ref={panelRef}
            className="user-menu"
            role="menu"
            aria-label="Account menu"
            onKeyDown={onMenuKeyDown}
          >
            <NavLink to="/settings/account" role="menuitem" className="user-menu-item" onClick={onNavigate}>
              <Icon.User />
              <span>Admin account</span>
            </NavLink>
            <NavLink to="/help" role="menuitem" className="user-menu-item" onClick={onNavigate}>
              <Icon.Help />
              <span>Help</span>
            </NavLink>
            <button type="button" role="menuitem" className="user-menu-item danger" onClick={onLogout}>
              <Icon.Logout />
              <span>Log out</span>
            </button>
          </div>
        )}
        <button
          ref={buttonRef}
          type="button"
          className="user-button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Avatar name={admin?.name || 'Admin'} size={34} />
          <span className="user-button-text">
            <strong>{admin?.name || 'Administrator'}</strong>
            <small>{admin?.email}</small>
          </span>
          <span className="user-button-caret" aria-hidden="true">
            <Icon.ChevronDown />
          </span>
        </button>
      </div>
    </aside>
  );
}
