import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_GROUPS, activeItemFor } from '../../core/config/navigation';
import { Icon, getIcon } from './Icon';
import { Avatar } from './ui';
import omsuLogo from '../../assets/omsu-logo.png';
import studiaLogo from '../../assets/studia-logo.png';

/**
 * Grouped navigation, driven entirely by core/config/navigation.js.
 * Collapsible on desktop, a drawer under 1024px. Sub-pages appear nested
 * under their parent while that section is active.
 */
export default function Sidebar({
  open,
  collapsed,
  counts = {},
  admin,
  onNavigate,
  onToggleCollapse,
  onLogout,
}) {
  const { pathname } = useLocation();
  const activePath = activeItemFor(pathname);
  // The menu remembers which page it was opened on, so any navigation closes
  // it without an effect — including Back and Forward.
  const [openedOn, setOpenedOn] = useState(null);
  const menuOpen = openedOn === pathname;
  const setMenuOpen = useCallback(
    (next) => setOpenedOn(next ? pathname : null),
    [pathname]
  );
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
    <aside
      id="sidebar"
      className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}
      aria-label="Portal navigation"
    >
      <div className="sidebar-top">
        <div className="sidebar-logos">
          <img src={omsuLogo} alt="OMSU seal" />
          {!collapsed && <img src={studiaLogo} alt="STUDIA" />}
        </div>
        <button
          type="button"
          className="collapse-btn"
          onClick={onToggleCollapse}
          aria-pressed={collapsed}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <Icon.Panel />
          <span className="sr-only">{collapsed ? 'Expand navigation' : 'Collapse navigation'}</span>
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.id}>
            <p className="nav-group-label" aria-hidden={collapsed ? 'true' : undefined}>
              {group.label}
            </p>
            <ul>
              {group.items.map((item) => {
                const IconCmp = getIcon(item.icon);
                const isActive = activePath === item.path;
                const badge = item.badge ? counts[item.badge] : 0;
                const children = item.children?.filter((c) => !c.path.includes(':')) ?? [];

                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="nav-icon">
                        <IconCmp />
                      </span>
                      <span className="nav-label">{item.label}</span>
                      {badge > 0 && <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>}
                    </NavLink>

                    {children.length > 0 && isActive && !collapsed && (
                      <ul className="nav-sub">
                        {children.map((child) => (
                          <li key={child.path}>
                            <NavLink
                              to={child.path}
                              onClick={onNavigate}
                              className={({ isActive: on }) => `nav-subitem ${on ? 'active' : ''}`}
                            >
                              {child.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
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
          {!collapsed && (
            <span className="user-button-text">
              <strong>{admin?.name || 'Administrator'}</strong>
              <small>{admin?.email}</small>
            </span>
          )}
          {!collapsed && (
            <span className="user-button-caret" aria-hidden="true">
              <Icon.ChevronDown />
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
