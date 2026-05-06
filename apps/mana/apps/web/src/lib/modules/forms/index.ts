// ─── Stores ──────────────────────────────────────────────
export { formsStore } from './stores/forms.svelte';
export { responsesStore } from './stores/responses.svelte';

// ─── Queries ─────────────────────────────────────────────
export {
	useAllForms,
	useFormsByStatus,
	useFormResponses,
	useResponsesByStatus,
	toForm,
	toFormResponse,
	searchForms,
} from './queries';

// ─── Collections ─────────────────────────────────────────
export { formTable, formResponseTable } from './collections';

// ─── Lib ─────────────────────────────────────────────────
export { makeDefaultField } from './lib/field-defaults';
export { resolveVisibleFields } from './lib/branching';
export { buildResponsesCsv, downloadResponsesCsv } from './lib/csv';
export {
	buildContactFromAnswers,
	buildEventGuestFromAnswers,
	applyAutoSync,
	runAutoSyncSweep,
} from './lib/auto-sync';
export { computeCohort, cohortLabel, sortCohortsDesc } from './lib/cohort';
export type { RecurrenceFrequency } from './lib/cohort';
export { nextWaveDueAt, isWaveDue, buildWaveMailto, parseRecipientEmails } from './lib/wave';
export { sendWaveViaBulkMail, WavePreconditionError } from './lib/wave-mail';
export type { WaveBulkSendResult } from './lib/wave-mail';
export { startWaveScheduler, stopWaveScheduler } from './lib/wave-scheduler';

// ─── Types ───────────────────────────────────────────────
export {
	FIELD_TYPE_LABELS,
	FORM_STATUS_LABELS,
	RESPONSE_STATUS_LABELS,
	DEFAULT_FORM_SETTINGS,
} from './types';
export type {
	LocalForm,
	Form,
	FormStatus,
	FormField,
	FieldType,
	FieldOption,
	FieldConfig,
	FormSettings,
	BranchingRule,
	BranchOperator,
	BranchAction,
	AutoSyncConfig,
	AutoSyncTarget,
	RecurrenceConfig,
	LocalFormResponse,
	FormResponse,
	ResponseStatus,
	AnswerValue,
	SubmitterMeta,
	SyncedTarget,
} from './types';
