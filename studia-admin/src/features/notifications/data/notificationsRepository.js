/**
 * NOTIFICATIONS REPOSITORY — the only module features/notifications may call
 * data from. Wraps core/data/api, so a future endpoint change touches one file.
 */
import * as api from '../../../core/data/api';

export const getNotifications = (params, options) => api.getNotifications(params, options);
export const markNotificationRead = (id, read) => api.markNotificationRead(id, read);
export const markAllNotificationsRead = () => api.markAllNotificationsRead();
