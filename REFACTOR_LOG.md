# REFACTOR_LOG

Structural refactor only: no UI, logic, or dependency changes.

## Phase A - studia-admin

### Files moved
| Old path | New path |
|---|---|
| studia-admin/src/pages/Login.jsx | studia-admin/src/features/auth/pages/Login.jsx |
| studia-admin/src/context/AuthContext.jsx | studia-admin/src/features/auth/context/AuthContext.jsx |
| studia-admin/src/components/ProtectedRoute.jsx | studia-admin/src/features/auth/components/ProtectedRoute.jsx |
| studia-admin/src/pages/Home.jsx | studia-admin/src/features/dashboard/pages/Home.jsx |
| studia-admin/src/pages/Users.jsx | studia-admin/src/features/users/pages/Users.jsx |
| studia-admin/src/pages/Settings.jsx | studia-admin/src/features/settings/pages/Settings.jsx |
| studia-admin/src/services/api.js | studia-admin/src/core/data/api.js |
| studia-admin/src/services/mockBackend.js | studia-admin/src/core/data/mock/mockBackend.js |
| studia-admin/src/data/mockData.js | studia-admin/src/core/data/mock/mockData.js |
| studia-admin/src/components/Layout.jsx | studia-admin/src/shared/components/Layout.jsx |
| studia-admin/src/components/ui.jsx | studia-admin/src/shared/components/ui.jsx |

### TODO(refactor) items
- studia-admin/src/shared/components/Layout.jsx: TODO(refactor): shared must not import features - move AuthContext to core/ later
- studia-admin/src/features/settings/pages/Settings.jsx: TODO(refactor): cross-feature import (settings -> auth); move AuthContext to core/ later
- studia-admin/src/features/dashboard/pages/Home.jsx (line 1): TODO(refactor): split UI / logic / data
- studia-admin/src/features/users/pages/Users.jsx (line 1): TODO(refactor): split UI / logic / data
- studia-admin/src/features/settings/pages/Settings.jsx (line 1): TODO(refactor): split UI / logic / data

### Notes
- Imports are relative (no alias, vite.config.js untouched).
- Future step: split core/data/api.js per feature (not done in this pass).

## Phase B - studia-mobile

### Files moved
| Old path | New path |
|---|---|
| studia-mobile/src/app/index.tsx | studia-mobile/src/features/onboarding/screens/welcome-screen.tsx |
| studia-mobile/src/app/learn-more.tsx | studia-mobile/src/features/onboarding/screens/learn-more-screen.tsx |
| studia-mobile/src/app/explore.tsx | studia-mobile/src/features/onboarding/screens/explore-screen.tsx |
| studia-mobile/src/app/auth.tsx | studia-mobile/src/features/auth/screens/auth-screen.tsx |
| studia-mobile/src/app/student/home.tsx | studia-mobile/src/features/student/screens/home-screen.tsx |
| studia-mobile/src/app/student/courses.tsx | studia-mobile/src/features/student/screens/courses-screen.tsx |
| studia-mobile/src/app/student/course-detail.tsx | studia-mobile/src/features/student/screens/course-detail-screen.tsx |
| studia-mobile/src/app/student/ai.tsx | studia-mobile/src/features/student/screens/ai-screen.tsx |
| studia-mobile/src/app/student/notifications.tsx | studia-mobile/src/features/student/screens/notifications-screen.tsx |
| studia-mobile/src/app/student/account.tsx | studia-mobile/src/features/student/screens/account-screen.tsx |
| studia-mobile/src/app/instructor/home.tsx | studia-mobile/src/features/instructor/screens/home-screen.tsx |
| studia-mobile/src/app/instructor/classes.tsx | studia-mobile/src/features/instructor/screens/classes-screen.tsx |
| studia-mobile/src/app/instructor/class-detail.tsx | studia-mobile/src/features/instructor/screens/class-detail-screen.tsx |
| studia-mobile/src/app/instructor/assessments.tsx | studia-mobile/src/features/instructor/screens/assessments-screen.tsx |
| studia-mobile/src/app/instructor/ai.tsx | studia-mobile/src/features/instructor/screens/ai-screen.tsx |
| studia-mobile/src/app/instructor/notifications.tsx | studia-mobile/src/features/instructor/screens/notifications-screen.tsx |
| studia-mobile/src/app/instructor/account.tsx | studia-mobile/src/features/instructor/screens/account-screen.tsx |
| studia-mobile/src/components/auth/auth-parts.tsx | studia-mobile/src/features/auth/components/auth-parts.tsx |
| studia-mobile/src/lib/auth-validation.ts | studia-mobile/src/features/auth/logic/auth-validation.ts |
| studia-mobile/src/services/auth-service.ts | studia-mobile/src/features/auth/data/auth-service.ts |
| studia-mobile/src/components/shared-screens.tsx | studia-mobile/src/features/shared-screens/components/shared-screens.tsx |
| studia-mobile/src/lib/mock-data.ts | studia-mobile/src/core/data/mock/mock-data.ts |
| studia-mobile/src/lib/session-store.ts | studia-mobile/src/core/data/storage/session-store.ts |
| studia-mobile/src/components/ui/app-button.tsx | studia-mobile/src/shared/components/ui/app-button.tsx |
| studia-mobile/src/components/ui/app-header.tsx | studia-mobile/src/shared/components/ui/app-header.tsx |
| studia-mobile/src/components/ui/parts.tsx | studia-mobile/src/shared/components/ui/parts.tsx |
| studia-mobile/src/components/ui/screen.tsx | studia-mobile/src/shared/components/ui/screen.tsx |
| studia-mobile/src/components/ui/studia-tab-bar.tsx | studia-mobile/src/shared/components/ui/studia-tab-bar.tsx |
| studia-mobile/src/constants/studia-colors.ts | studia-mobile/src/shared/constants/studia-colors.ts |
| studia-mobile/src/hooks/use-color-scheme.ts | studia-mobile/src/shared/hooks/use-color-scheme.ts |

### Role type move (rule 7)
- `export type Role` moved from features/auth/logic/auth-validation.ts to core/types/role.ts; auth-validation.ts now imports it and re-exports `export type { Role }`, so existing imports keep working. session-store.ts, mock-data.ts, screen.tsx and shared-screens.tsx now import Role from @/core/types/role (path only) so core/shared do not depend on features.

### TODO(refactor) items
- studia-mobile/src/features/auth/screens/auth-screen.tsx (line 1): TODO(refactor): split UI / logic / data
- studia-mobile/src/features/shared-screens/components/shared-screens.tsx (line 1): TODO(refactor): split UI / logic / data
- studia-mobile/src/features/student/screens/home-screen.tsx: TODO(refactor): route through data/ layer
- studia-mobile/src/features/student/screens/courses-screen.tsx: TODO(refactor): route through data/ layer
- studia-mobile/src/features/student/screens/course-detail-screen.tsx: TODO(refactor): route through data/ layer
- studia-mobile/src/features/instructor/screens/home-screen.tsx: TODO(refactor): route through data/ layer
- studia-mobile/src/features/instructor/screens/classes-screen.tsx: TODO(refactor): route through data/ layer
- studia-mobile/src/features/instructor/screens/class-detail-screen.tsx: TODO(refactor): route through data/ layer
- studia-mobile/src/features/instructor/screens/assessments-screen.tsx: TODO(refactor): route through data/ layer
- studia-mobile/src/features/shared-screens/components/shared-screens.tsx: TODO(refactor): route through data/ layer
- features/student + instructor screens import @/features/shared-screens (feature -> feature). Spec says features must not import each other; decide later whether shared-screens moves to shared/.

### Notes
- explore.tsx is NOT template leftover: _layout.tsx registers <Stack.Screen name="explore" />. Moved to features/onboarding/screens/explore-screen.tsx with a thin route.
- No route file had named exports besides default (checked), so thin routes re-export default only.
- _layout.tsx files stayed in place; only their import paths changed.
