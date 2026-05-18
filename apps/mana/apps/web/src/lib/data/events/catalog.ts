/**
 * Domain Event Catalog — Typed event definitions for all modules.
 *
 * Each module section defines payload interfaces and a string-literal
 * union of event types. The top-level ManaEvent union covers every
 * possible event so the EventStore and Projection Engine can work
 * with full type safety.
 *
 * Pilot modules: Todo, Calendar, Drink, Food, Places.
 */

import type { DomainEvent } from './types';

// ── Todo ────────────────────────────────────────────

export interface TaskCreatedPayload {
	taskId: string;
	title: string;
	dueDate?: string;
	priority?: number;
	projectId?: string;
	labelIds?: string[];
}

export interface TaskCompletedPayload {
	taskId: string;
	title: string;
	projectId?: string;
	wasOverdue: boolean;
}

export interface TaskUncompletedPayload {
	taskId: string;
	title: string;
}

export interface TaskUpdatedPayload {
	taskId: string;
	fields: string[];
}

export interface TaskDeletedPayload {
	taskId: string;
	title: string;
}

export interface TaskRescheduledPayload {
	taskId: string;
	title: string;
	oldDate?: string;
	newDate: string;
}

export interface SubtasksUpdatedPayload {
	taskId: string;
	total: number;
	completed: number;
}

export interface ReminderSetPayload {
	taskId: string;
	reminderId: string;
	minutesBefore: number;
	type?: string;
}

export interface ReminderDeletedPayload {
	taskId: string;
	reminderId: string;
}

export type TodoEventType =
	| 'TaskCreated'
	| 'TaskCompleted'
	| 'TaskUncompleted'
	| 'TaskUpdated'
	| 'TaskDeleted'
	| 'TaskRescheduled'
	| 'SubtasksUpdated'
	| 'ReminderSet'
	| 'ReminderDeleted';

// ── Calendar ────────────────────────────────────────

export interface CalendarEventCreatedPayload {
	eventId: string;
	title: string;
	startTime: string;
	endTime: string;
	isAllDay: boolean;
	isRecurring: boolean;
	calendarId: string;
	location?: string;
}

export interface CalendarEventUpdatedPayload {
	eventId: string;
	fields: string[];
}

export interface CalendarEventDeletedPayload {
	eventId: string;
	title: string;
	wasRecurring: boolean;
}

export interface CalendarEventMovedPayload {
	eventId: string;
	title: string;
	oldStart: string;
	newStart: string;
}

export type CalendarEventType =
	| 'CalendarEventCreated'
	| 'CalendarEventUpdated'
	| 'CalendarEventDeleted'
	| 'CalendarEventMoved';

// ── Drink ───────────────────────────────────────────

export interface DrinkLoggedPayload {
	entryId: string;
	drinkType: string;
	quantityMl: number;
	name: string;
	date: string;
	time: string;
	fromPreset: boolean;
}

export interface DrinkEntryDeletedPayload {
	entryId: string;
	drinkType: string;
	quantityMl: number;
}

export interface DrinkEntryUndonePayload {
	entryId: string;
}

export type DrinkEventType = 'DrinkLogged' | 'DrinkEntryDeleted' | 'DrinkEntryUndone';

// ── Places ──────────────────────────────────────────

export interface PlaceCreatedPayload {
	placeId: string;
	name: string;
	category?: string;
	lat: number;
	lng: number;
}

export interface PlaceDeletedPayload {
	placeId: string;
	name: string;
}

export interface PlaceVisitedPayload {
	placeId: string;
	name: string;
	visitCount: number;
}

export interface LocationLoggedPayload {
	logId: string;
	lat: number;
	lng: number;
	placeId?: string;
	accuracy?: number;
}

export interface TrackingStartedPayload {
	timestamp: string;
}

export interface TrackingStoppedPayload {
	durationMs: number;
	logCount: number;
}

export type PlacesEventType =
	| 'PlaceCreated'
	| 'PlaceDeleted'
	| 'PlaceVisited'
	| 'LocationLogged'
	| 'TrackingStarted'
	| 'TrackingStopped';

// ── Habits ──────────────────────────────────────────

export interface HabitLoggedPayload {
	logId: string;
	habitId: string;
	habitTitle: string;
	note?: string;
}

export interface HabitCreatedPayload {
	habitId: string;
	title: string;
}

export interface HabitDeletedPayload {
	habitId: string;
	title: string;
}

export type HabitsEventType = 'HabitLogged' | 'HabitCreated' | 'HabitDeleted';

// ── Journal ─────────────────────────────────────────

export interface JournalEntryCreatedPayload {
	entryId: string;
	title?: string;
	mood?: string;
	hasContent: boolean;
}

export interface JournalMoodSetPayload {
	entryId: string;
	mood: string;
}

export interface JournalEntryDeletedPayload {
	entryId: string;
}

export type JournalEventType = 'JournalEntryCreated' | 'JournalMoodSet' | 'JournalEntryDeleted';

// ── Notes ───────────────────────────────────────────

export interface NoteCreatedPayload {
	noteId: string;
	title?: string;
}

export interface NoteDeletedPayload {
	noteId: string;
}

export type NotesEventType = 'NoteCreated' | 'NoteDeleted';

// ── Contacts ────────────────────────────────────────

export interface ContactCreatedPayload {
	contactId: string;
	firstName: string;
	lastName?: string;
}

export interface ContactDeletedPayload {
	contactId: string;
	name: string;
}

export type ContactsEventType = 'ContactCreated' | 'ContactDeleted';

// ── Finance ─────────────────────────────────────────

export interface TransactionCreatedPayload {
	transactionId: string;
	amount: number;
	type: string;
	category?: string;
	description?: string;
}

export interface TransactionDeletedPayload {
	transactionId: string;
}

export type FinanceEventType = 'TransactionCreated' | 'TransactionDeleted';

// ── Dreams ──────────────────────────────────────────

export interface DreamCreatedPayload {
	dreamId: string;
	title?: string;
	isLucid: boolean;
	mood?: string;
}

export interface DreamDeletedPayload {
	dreamId: string;
}

export type DreamsEventType = 'DreamCreated' | 'DreamDeleted';

// ── Cards ───────────────────────────────────────────

export interface CardStudiedPayload {
	cardId: string;
	deckId: string;
	quality: number;
}

export interface CardCreatedPayload {
	cardId: string;
	deckId: string;
}

export type CardsEventType = 'CardStudied' | 'CardCreated';

// ── Times ───────────────────────────────────────────

export interface TimerStartedPayload {
	entryId: string;
	description?: string;
	projectId?: string;
}

export interface TimerStoppedPayload {
	entryId: string;
	durationMinutes: number;
	description?: string;
}

export type TimesEventType = 'TimerStarted' | 'TimerStopped';

// ── Music ───────────────────────────────────────────

export interface SongAddedPayload {
	songId: string;
	title: string;
}

export interface PlaylistCreatedPayload {
	playlistId: string;
	name: string;
}

export type MusicEventType = 'SongAdded' | 'PlaylistCreated';

// ── Storage ─────────────────────────────────────────

export interface FolderCreatedPayload {
	folderId: string;
	name: string;
	parentId?: string;
}

export interface FileDeletedPayload {
	fileId: string;
}

export type StorageEventType = 'FolderCreated' | 'FileDeleted';

// ── Chat ────────────────────────────────────────────

export interface ChatMessageSentPayload {
	messageId: string;
	conversationId: string;
}

export interface ChatConversationCreatedPayload {
	conversationId: string;
	title?: string;
}

export type ChatEventType = 'ChatMessageSent' | 'ChatConversationCreated';

// ── Memoro ──────────────────────────────────────────

export interface MemoCreatedPayload {
	memoId: string;
	fromVoice: boolean;
}

export interface MemoDeletedPayload {
	memoId: string;
}

export type MemoroEventType = 'MemoCreated' | 'MemoDeleted';

// ── Skilltree ───────────────────────────────────────

export interface SkillXpAddedPayload {
	skillId: string;
	skillName: string;
	xp: number;
	totalXp: number;
}

export interface SkillCreatedPayload {
	skillId: string;
	name: string;
}

export type SkilltreeEventType = 'SkillXpAdded' | 'SkillCreated';

// ── Social Events ───────────────────────────────────

export interface SocialEventCreatedPayload {
	eventId: string;
	title: string;
	date?: string;
}

export interface SocialEventDeletedPayload {
	eventId: string;
}

export type SocialEventsEventType = 'SocialEventCreated' | 'SocialEventDeleted';

// ── Period ──────────────────────────────────────────

export interface PeriodDayLoggedPayload {
	logId: string;
	date: string;
	flow?: string;
}
export type PeriodEventType = 'PeriodDayLogged';

// ── Firsts ──────────────────────────────────────────

export interface FirstCreatedPayload {
	firstId: string;
	title: string;
	isLived: boolean;
}
export type FirstsEventType = 'FirstCreated';

// ── Guides ──────────────────────────────────────────

export interface GuideCreatedPayload {
	guideId: string;
	title: string;
}
export type GuidesEventType = 'GuideCreated';

// ── Inventory ───────────────────────────────────────

export interface InventoryItemCreatedPayload {
	itemId: string;
	name: string;
	category?: string;
}
export type InventoryEventType = 'InventoryItemCreated';

// ── Photos ──────────────────────────────────────────

export interface PhotoDeletedPayload {
	photoId: string;
}
export type PhotosEventType = 'PhotoDeleted';

// ── Plants ──────────────────────────────────────────

export interface PlantCreatedPayload {
	plantId: string;
	name: string;
	species?: string;
}
export interface PlantDeletedPayload {
	plantId: string;
}
export type PlantsEventType = 'PlantCreated' | 'PlantDeleted';

// ── News ────────────────────────────────────────────

export interface ArticleSavedPayload {
	articleId: string;
	title: string;
}
export interface ArticleImportStartedPayload {
	jobId: string;
	totalUrls: number;
}
export interface ArticleImportFinishedPayload {
	jobId: string;
	totalUrls: number;
	savedCount: number;
	duplicateCount: number;
	errorCount: number;
	warningCount: number;
}
export type NewsEventType = 'ArticleSaved' | 'ArticleImportStarted' | 'ArticleImportFinished';

// ── Recipes ─────────────────────────────────────────

export interface RecipeCreatedPayload {
	recipeId: string;
	title: string;
}
export interface RecipeDeletedPayload {
	recipeId: string;
}
export type RecipesEventType = 'RecipeCreated' | 'RecipeDeleted';

// ── Questions ───────────────────────────────────────

export interface QuestionAskedPayload {
	questionId: string;
	question: string;
}
export type QuestionsEventType = 'QuestionAsked';

// ── Meditate ────────────────────────────────────────

export interface MeditationCompletedPayload {
	sessionId: string;
	category: string;
	durationMinutes: number;
	completed: boolean;
}
export type MeditateEventType = 'MeditationCompleted';

// ── Sleep ───────────────────────────────────────────

export interface SleepLoggedPayload {
	entryId: string;
	date: string;
	durationMin: number;
	quality: number;
}
export type SleepEventType = 'SleepLogged';

// ── Companion (Chat + Tools) ────────────────────────

export interface CompanionConversationStartedPayload {
	conversationId: string;
	title?: string;
}

export interface CompanionMessageSentPayload {
	messageId: string;
	conversationId: string;
	role: 'user' | 'assistant';
	contentLength: number;
}

export interface CompanionToolCalledPayload {
	tool: string;
	module: string;
	success: boolean;
	latencyMs: number;
	errorMessage?: string;
}

export type CompanionEventType =
	| 'CompanionConversationStarted'
	| 'CompanionMessageSent'
	| 'CompanionToolCalled';

// ── Body ────────────────────────────────────────────

export interface WorkoutStartedPayload {
	workoutId: string;
	title?: string;
	routineId?: string;
}

export interface WorkoutFinishedPayload {
	workoutId: string;
	title: string;
	durationMinutes: number;
	setCount: number;
}

export interface SetLoggedPayload {
	setId: string;
	workoutId: string;
	exerciseId: string;
	reps: number;
	weight: number;
}

export interface MeasurementLoggedPayload {
	measurementId: string;
	type: string;
	value: number;
	unit: string;
}

export interface EnergyCheckLoggedPayload {
	checkId: string;
	energy?: number;
	mood?: number;
}

export type BodyEventType =
	| 'WorkoutStarted'
	| 'WorkoutFinished'
	| 'SetLogged'
	| 'MeasurementLogged'
	| 'EnergyCheckLogged';

// ── Visibility (Cross-Module) ───────────────────────
// Emitted by any module whose records carry a `visibility` field when
// the user flips it (typically via <VisibilityPicker>). The payload type
// lives in @mana/shared-privacy so the event shape stays aligned with
// the primitives. See docs/plans/visibility-system.md.

import type { VisibilityChangedPayload } from '@mana/shared-privacy';
export type { VisibilityChangedPayload };

export type VisibilityEventType = 'VisibilityChanged';

// ── System Events (Goals, Companion) ────────────────

export interface GoalReachedPayload {
	goalId: string;
	title: string;
	value: number;
	target: number;
	period: string;
}

export interface GoalProgressPayload {
	goalId: string;
	title: string;
	value: number;
	target: number;
}

export type SystemEventType = 'GoalReached' | 'GoalProgress';

// ── Union of all event types ────────────────────────

export type ManaEventType =
	| TodoEventType
	| CalendarEventType
	| DrinkEventType
	| PlacesEventType
	| HabitsEventType
	| JournalEventType
	| NotesEventType
	| ContactsEventType
	| FinanceEventType
	| DreamsEventType
	| CardsEventType
	| TimesEventType
	| MusicEventType
	| StorageEventType
	| ChatEventType
	| MemoroEventType
	| SkilltreeEventType
	| PeriodEventType
	| FirstsEventType
	| GuidesEventType
	| InventoryEventType
	| PhotosEventType
	| PlantsEventType
	| NewsEventType
	| RecipesEventType
	| QuestionsEventType
	| MeditateEventType
	| SleepEventType
	| CompanionEventType
	| SocialEventsEventType
	| BodyEventType
	| SystemEventType
	| VisibilityEventType;

/**
 * Discriminated union of all domain events.
 * Use this for the EventStore subscriber and Projection handlers.
 */
export type ManaEvent =
	// Todo
	| DomainEvent<'TaskCreated', TaskCreatedPayload>
	| DomainEvent<'TaskCompleted', TaskCompletedPayload>
	| DomainEvent<'TaskUncompleted', TaskUncompletedPayload>
	| DomainEvent<'TaskUpdated', TaskUpdatedPayload>
	| DomainEvent<'TaskDeleted', TaskDeletedPayload>
	| DomainEvent<'TaskRescheduled', TaskRescheduledPayload>
	| DomainEvent<'SubtasksUpdated', SubtasksUpdatedPayload>
	| DomainEvent<'ReminderSet', ReminderSetPayload>
	| DomainEvent<'ReminderDeleted', ReminderDeletedPayload>
	// Calendar
	| DomainEvent<'CalendarEventCreated', CalendarEventCreatedPayload>
	| DomainEvent<'CalendarEventUpdated', CalendarEventUpdatedPayload>
	| DomainEvent<'CalendarEventDeleted', CalendarEventDeletedPayload>
	| DomainEvent<'CalendarEventMoved', CalendarEventMovedPayload>
	// Drink
	| DomainEvent<'DrinkLogged', DrinkLoggedPayload>
	| DomainEvent<'DrinkEntryDeleted', DrinkEntryDeletedPayload>
	| DomainEvent<'DrinkEntryUndone', DrinkEntryUndonePayload>
	// Places
	| DomainEvent<'PlaceCreated', PlaceCreatedPayload>
	| DomainEvent<'PlaceDeleted', PlaceDeletedPayload>
	| DomainEvent<'PlaceVisited', PlaceVisitedPayload>
	| DomainEvent<'LocationLogged', LocationLoggedPayload>
	| DomainEvent<'TrackingStarted', TrackingStartedPayload>
	| DomainEvent<'TrackingStopped', TrackingStoppedPayload>
	// Habits
	| DomainEvent<'HabitLogged', HabitLoggedPayload>
	| DomainEvent<'HabitCreated', HabitCreatedPayload>
	| DomainEvent<'HabitDeleted', HabitDeletedPayload>
	// Journal
	| DomainEvent<'JournalEntryCreated', JournalEntryCreatedPayload>
	| DomainEvent<'JournalMoodSet', JournalMoodSetPayload>
	| DomainEvent<'JournalEntryDeleted', JournalEntryDeletedPayload>
	// Notes
	| DomainEvent<'NoteCreated', NoteCreatedPayload>
	| DomainEvent<'NoteDeleted', NoteDeletedPayload>
	// Contacts
	| DomainEvent<'ContactCreated', ContactCreatedPayload>
	| DomainEvent<'ContactDeleted', ContactDeletedPayload>
	// Finance
	| DomainEvent<'TransactionCreated', TransactionCreatedPayload>
	| DomainEvent<'TransactionDeleted', TransactionDeletedPayload>
	// Dreams
	| DomainEvent<'DreamCreated', DreamCreatedPayload>
	| DomainEvent<'DreamDeleted', DreamDeletedPayload>
	// Cards
	| DomainEvent<'CardStudied', CardStudiedPayload>
	| DomainEvent<'CardCreated', CardCreatedPayload>
	// Times
	| DomainEvent<'TimerStarted', TimerStartedPayload>
	| DomainEvent<'TimerStopped', TimerStoppedPayload>
	// Music
	| DomainEvent<'SongAdded', SongAddedPayload>
	| DomainEvent<'PlaylistCreated', PlaylistCreatedPayload>
	// Storage
	| DomainEvent<'FolderCreated', FolderCreatedPayload>
	| DomainEvent<'FileDeleted', FileDeletedPayload>
	// Chat
	| DomainEvent<'ChatMessageSent', ChatMessageSentPayload>
	| DomainEvent<'ChatConversationCreated', ChatConversationCreatedPayload>
	// Memoro
	| DomainEvent<'MemoCreated', MemoCreatedPayload>
	| DomainEvent<'MemoDeleted', MemoDeletedPayload>
	// Skilltree
	| DomainEvent<'SkillXpAdded', SkillXpAddedPayload>
	| DomainEvent<'SkillCreated', SkillCreatedPayload>
	// Period
	| DomainEvent<'PeriodDayLogged', PeriodDayLoggedPayload>
	// Firsts
	| DomainEvent<'FirstCreated', FirstCreatedPayload>
	// Guides
	| DomainEvent<'GuideCreated', GuideCreatedPayload>
	// Inventory
	| DomainEvent<'InventoryItemCreated', InventoryItemCreatedPayload>
	// Photos
	| DomainEvent<'PhotoDeleted', PhotoDeletedPayload>
	// Plants
	| DomainEvent<'PlantCreated', PlantCreatedPayload>
	| DomainEvent<'PlantDeleted', PlantDeletedPayload>
	// News
	| DomainEvent<'ArticleSaved', ArticleSavedPayload>
	| DomainEvent<'ArticleImportStarted', ArticleImportStartedPayload>
	| DomainEvent<'ArticleImportFinished', ArticleImportFinishedPayload>
	// Recipes
	| DomainEvent<'RecipeCreated', RecipeCreatedPayload>
	| DomainEvent<'RecipeDeleted', RecipeDeletedPayload>
	// Questions
	| DomainEvent<'QuestionAsked', QuestionAskedPayload>
	// Meditate
	| DomainEvent<'MeditationCompleted', MeditationCompletedPayload>
	// Sleep
	| DomainEvent<'SleepLogged', SleepLoggedPayload>
	// Companion
	| DomainEvent<'CompanionConversationStarted', CompanionConversationStartedPayload>
	| DomainEvent<'CompanionMessageSent', CompanionMessageSentPayload>
	| DomainEvent<'CompanionToolCalled', CompanionToolCalledPayload>
	// Social Events
	| DomainEvent<'SocialEventCreated', SocialEventCreatedPayload>
	| DomainEvent<'SocialEventDeleted', SocialEventDeletedPayload>
	// Body
	| DomainEvent<'WorkoutStarted', WorkoutStartedPayload>
	| DomainEvent<'WorkoutFinished', WorkoutFinishedPayload>
	| DomainEvent<'SetLogged', SetLoggedPayload>
	| DomainEvent<'MeasurementLogged', MeasurementLoggedPayload>
	| DomainEvent<'EnergyCheckLogged', EnergyCheckLoggedPayload>
	// System
	| DomainEvent<'GoalReached', GoalReachedPayload>
	| DomainEvent<'GoalProgress', GoalProgressPayload>
	// Visibility (cross-module)
	| DomainEvent<'VisibilityChanged', VisibilityChangedPayload>;
