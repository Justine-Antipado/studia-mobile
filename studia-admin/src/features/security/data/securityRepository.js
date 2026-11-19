/**
 * SECURITY REPOSITORY — the only module features/security may call data from.
 * Wraps core/data/api, so a future endpoint change touches one file.
 */
import * as api from '../../../core/data/api';

export const getAuditLog = (params, options) => api.getAuditLog(params, options);
export const getSessions = (options) => api.getSessions(options);
export const revokeSession = (id) => api.revokeSession(id);
export const getLoginAttempts = (params, options) => api.getLoginAttempts(params, options);
export const getVulnerabilities = (options) => api.getVulnerabilities(options);
