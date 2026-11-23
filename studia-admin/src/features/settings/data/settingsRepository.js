/**
 * SETTINGS REPOSITORY — the only module features/settings may call data from.
 * Wraps core/data/api, so a future endpoint change touches one file.
 *
 * AI toggles are deliberately NOT re-exported here: /settings/ai imports
 * updateAiFeature straight from features/ai/data/aiRepository so the toggle
 * switches and /ai keep calling the exact same function (one source, not a
 * second copy that could drift — see docs/admin-progress.md phase 7).
 */
import * as api from '../../../core/data/api';

export const getSettings = (options) => api.getSettings(options);
export const saveSettings = (patch) => api.saveSettings(patch);

export const sendOtp = () => api.sendOtp();
export const verifyOtp = (code) => api.verifyOtp(code);
export const updatePassword = (code, newPassword) => api.updatePassword(code, newPassword);
