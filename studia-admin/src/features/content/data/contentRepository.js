/**
 * CONTENT REPOSITORY — the only module features/content may call data from.
 * Wraps core/data/api, so a future endpoint change touches one file.
 */
import * as api from '../../../core/data/api';

export const getContent = (params, options) => api.getContent(params, options);
export const deleteContent = (ids) => api.deleteContent(ids);
