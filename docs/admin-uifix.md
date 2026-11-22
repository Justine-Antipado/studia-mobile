You are working on the OMSU Studia admin web dashboard (sidebar sections: Overview, People, Academics, Intelligence, System). Fix the UI/UX issues below. Reuse the existing design tokens: the purple sidebar gradient, the #5B47B5-style primary purple, rounded white cards and the Poppins-style font. Build reusable components instead of one-off fixes. Don't change any data or business logic that isn't mentioned here.

## 1. Remove the visible scrollbars (sidebar + main page)
- Right now there are two visible native scrollbars. One is inside the sidebar nav, the white/grey bar next to the menu items. The other is on the far right of the page.
- Hide both scrollbars visually but keep scrolling working: `scrollbar-width: none;` plus `::-webkit-scrollbar { display: none; }`. Put this in a reusable `.no-scrollbar` utility.
- Fix the layout so there are no nested double scroll areas:
  - The app shell is `height: 100vh; overflow: hidden;` with the sidebar fixed on the left.
  - Only the main content area scrolls (`overflow-y: auto`).
  - The sidebar nav list scrolls on its own only if it overflows. The logo stays pinned at the top and the user profile stays pinned at the bottom.
- Optional: add a soft fade or gradient at the top and bottom of the sidebar nav when there's more to scroll, as a scroll hint.

## 2. Fix the expandable nav items (Security and Settings)
- Bug: clicking "Security" (or "Settings") expands the sub-menu (Audit log, Sessions, Login attempts, Vulnerabilities). Clicking it again does NOT collapse it.
- Expected behavior is a true toggle:
  - Click when collapsed → expand the sub-menu.
  - Click when expanded → collapse the sub-menu.
- Add a chevron icon on the right side of expandable items. It rotates 0° → 180° (or 90°) when open.
- Animate expand/collapse smoothly (height/opacity transition, about 200ms ease).
- If the current route is one of the children, the parent opens automatically on page load and stays highlighted. The user can still collapse it manually.
- Optional accordion behavior: opening Security closes Settings, and vice versa.
- Add `aria-expanded` and `aria-controls`, and support toggling with Enter/Space.

## 3. Remove the sidebar minimize/collapse feature
- Remove the collapse toggle button next to the logos (top-right of the sidebar).
- Remove the icon-only collapsed sidebar state entirely, including its state, CSS classes, localStorage key, and any conditional rendering.
- The sidebar is always fully expanded on desktop. (On mobile/tablet widths, an off-canvas drawer with a hamburger button is fine.)

## 4. Remove the duplicate page headers
- Every page currently shows its title twice. The top bar shows "Dashboard / Platform activity, users and AI usage at a glance." and then the page body repeats the same "Dashboard" title and subtitle.
- Keep ONLY the top bar header (title + subtitle + Mock data badge + bell).
- Delete the repeated in-page title/subtitle block on ALL pages (Dashboard, Users, Classes, Content, Assessments, Announcements, AI health, Reports, Notifications, Security sub-pages, Settings, Help).
- The top bar title/subtitle should come from one source, like a route config or a page-meta hook, so it's defined once per page.
- Reduce the content area's top padding so the stat cards start right below the top bar.

## 5. Fix "Mark all as read" in Notifications
- Bug: clicking "Mark all as read" shows a plain text message "All notifications marked as read" on the page instead of actually doing the action.
- Expected:
  - Immediately mark every notification as read in state (optimistic update), and call the API/mock handler.
  - Remove the unread styling (dot, bold text, tinted background) from all items with a smooth transition.
  - Update the unread badge on the sidebar "Notifications" item and the red dot on the top-bar bell to 0/hidden right away.
  - Disable the "Mark all as read" button (or hide it) while there are 0 unread notifications.
  - Remove the inline status text. If feedback is needed, use a small auto-dismissing toast in the corner (about 2.5s). Never put text inside the page layout.
  - If the request fails, roll back the state and show an error toast.
- Clicking a single notification marks just that one as read and decrements the badge.

## 6. Turn table actions into real buttons
- In the Users table (and every other table with an Actions column), "View", "Export" and "Delete" are currently plain colored text links with icons, and they look misaligned.
- Replace them with a reusable `<ActionButton>` / `<IconButton>` component:
  - Compact icon buttons (32–36px, rounded-lg) with a tooltip label on hover. Alternatively, small outlined buttons with icon + label. Use one style consistently everywhere.
  - View = neutral/primary purple, Export = neutral, Delete = red/destructive.
  - Hover, focus-visible ring, active/pressed and disabled states.
  - Proper alignment: buttons sit in a flex row with consistent gap, right-aligned in the Actions column, and vertically centered in the row.
- "Delete" must open a styled confirmation modal ("Delete Ana Villanueva? This can't be undone." with Cancel / Delete buttons) before deleting.
- Optional: on narrow widths, collapse the actions into a "⋯" kebab menu that uses the custom dropdown from #7.

## 7. Replace native dropdowns with a custom styled Select
- All `<select>` elements (e.g. the "Status: All statuses / Active / Inactive" filter, Role, Course/Dept, etc.) currently use the plain native browser dropdown.
- Build one reusable `<Select>` component and replace every native select with it:
  - Trigger: rounded-xl, white background, 1px border, chevron icon that rotates when open, purple focus ring.
  - Menu: floating card with shadow, rounded-xl, small fade/scale-in animation, max-height with hidden scrollbar.
  - Options: hover background (light purple), selected option shows a ✓ check and purple text.
  - Optional colored dot for status options (Active = green, Inactive = grey).
  - Closes on outside click, Esc and option select.
  - Full keyboard support: ↑/↓ to move, Enter to select, type-ahead, and the proper ARIA listbox roles.
  - Supports placeholder, disabled state, and (if needed) a searchable variant for long lists like Course/Dept.
- Selecting a filter updates the table immediately.

## 8. Make the whole dashboard more interactive
- Sidebar items: hover background, smooth active-state transition, and a left accent bar or pill on the active item.
- Stat cards: subtle hover lift (translateY(-2px) + shadow) and a count-up animation on load. Make them clickable to their related page (Total users → Users, Classes → Classes, AI requests → AI health).
- Charts: tooltips on hover for the line chart points, donut segments and bars, with the exact value and label. Animate the charts on first render. Add value labels or axes to the bar charts ("Users by course", "AI usage by feature") so the bars are readable.
- Table rows: hover highlight. Clicking a row opens View.
- Every interactive element gets visible focus states and `cursor: pointer`.
- Keep transitions at 150–250ms and respect `prefers-reduced-motion`.

## Acceptance checklist
- [ ] No visible scrollbars in the sidebar or the page, and scrolling still works.
- [ ] Security and Settings expand AND collapse on repeated clicks, with an animated chevron.
- [ ] No sidebar minimize button or collapsed mode anywhere.
- [ ] Each page shows its title only once (top bar).
- [ ] "Mark all as read" clears the unread states, badge and bell dot instantly, with no stray text.
- [ ] All table actions are styled buttons, and Delete asks for confirmation.
- [ ] No native `<select>` remains. All use the custom Select.
- [ ] Hover, focus and animation states are present and consistent.

After the changes, list every file you modified and briefly explain each fix.

