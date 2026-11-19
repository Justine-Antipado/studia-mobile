/**
 * ANNOUNCEMENTS REPOSITORY — the only module features/announcements may call data from.
 * Wraps core/data/api, so a future endpoint change touches one file.
 */
import * as api from '../../../core/data/api';

export const getAnnouncements = (params, options) => api.getAnnouncements(params, options);
export const createAnnouncement = (input) => api.createAnnouncement(input);
export const deleteAnnouncements = (ids) => api.deleteAnnouncements(ids);
