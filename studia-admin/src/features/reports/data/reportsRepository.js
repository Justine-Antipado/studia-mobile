/**
 * REPORTS REPOSITORY — the only module features/reports may call data from.
 * Wraps core/data/api, so a future endpoint change touches one file.
 */
import * as api from '../../../core/data/api';

export const getReports = (options) => api.getReports(options);
