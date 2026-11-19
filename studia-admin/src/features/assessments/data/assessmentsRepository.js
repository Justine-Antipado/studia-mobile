/**
 * ASSESSMENTS REPOSITORY — the only module features/assessments may call data from.
 * Wraps core/data/api, so a future endpoint change touches one file.
 */
import * as api from '../../../core/data/api';

export const getAssessments = (options) => api.getAssessments(options);
