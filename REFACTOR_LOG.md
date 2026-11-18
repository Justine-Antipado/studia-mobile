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
