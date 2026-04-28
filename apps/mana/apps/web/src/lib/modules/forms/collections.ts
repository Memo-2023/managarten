import { db } from '$lib/data/database';
import type { LocalForm, LocalFormResponse } from './types';

export const formTable = db.table<LocalForm>('forms');
export const formResponseTable = db.table<LocalFormResponse>('formResponses');
