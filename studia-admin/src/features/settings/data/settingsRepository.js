/**
 * SETTINGS REPOSITORY — the only module features/settings may call data from.
 * Wraps core/data/api, so a future endpoint change touches one file.
 *
 * AI toggles are not part of this repository: /ai owns them
 * (features/ai/data/aiRepository).
 */
import * as api from '../../../core/data/api';

export const getSettings = (options) => api.getSettings(options);
export const saveSettings = (patch) => api.saveSettings(patch);

export const sendOtp = () => api.sendOtp();
export const verifyOtp = (code) => api.verifyOtp(code);
export const updatePassword = (code, newPassword) => api.updatePassword(code, newPassword);
