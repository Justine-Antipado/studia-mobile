/**
 * AI REPOSITORY — the only module features/ai may call data from.
 * Wraps core/data/api, so a future endpoint change touches one file.
 */
import * as api from '../../../core/data/api';

export const getAiHealth = (options) => api.getAiHealth(options);
export const updateAiFeature = (feature, enabled) => api.updateAiFeature(feature, enabled);
