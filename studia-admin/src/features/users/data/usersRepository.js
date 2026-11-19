/**
 * USERS REPOSITORY — the only module features/users may call data from.
 * Wraps core/data/api, so a future endpoint change touches one file.
 */
import * as api from '../../../core/data/api';

export const getUsers = (params, options) => api.getUsers(params, options);
export const getUser = (id, options) => api.getUser(id, options);
export const deleteUsers = (ids) => api.deleteUsers(ids);
