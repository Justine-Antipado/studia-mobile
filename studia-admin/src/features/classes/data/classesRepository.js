/**
 * CLASSES REPOSITORY — the only module features/classes may call data from.
 * Wraps core/data/api, so a future endpoint change touches one file.
 */
import * as api from '../../../core/data/api';

export const getClasses = (params, options) => api.getClasses(params, options);
export const getClass = (id, options) => api.getClass(id, options);
export const deleteClasses = (ids) => api.deleteClasses(ids);
