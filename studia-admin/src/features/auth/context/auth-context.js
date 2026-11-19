import { createContext } from 'react';

/**
 * The context object only. It lives apart from the provider component so that
 * AuthContext.jsx exports a component and nothing else (fast refresh), and so
 * features/auth/hooks/useAuth.js can read it without importing the provider.
 */
export const AuthContext = createContext(null);
