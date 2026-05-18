/**
 * Goals Tools — LLM-accessible operations for the goal system.
 *
 * Goals are event-driven: progress auto-increments when matching
 * domain events fire (e.g. DrinkLogged, TaskCompleted). These tools
 * let agents read progress, create new goals, and manage status.
 */

import type { ModuleTool } from '$lib/data/tools/types';
import { db } from '$lib/data/database';
import { goalStore } from '$lib/companion/goals/store';
import { GOAL_TEMPLATES, type LocalGoal } from '$lib/companion/goals/types';

const TABLE = 'companionGoals';

export const goalsTools: ModuleTool[] = [
	{
		name: 'list_goals',
		module: 'goals',
		description:
			'Listet alle Ziele mit aktuellem Fortschritt auf. Zeigt Titel, Fortschritt, Zielwert, Zeitraum und Status.',
		parameters: [
			{
				name: 'filter',
				type: 'string',
				description: 'Welche Ziele zeigen',
				required: false,
				enum: ['active', 'paused', 'completed', 'all'],
			},
		],
		async execute(params) {
			const filter = (params.filter as string) ?? 'active';
			const all = await db.table<LocalGoal>(TABLE).toArray();
			const visible = all.filter((g) => !g.deletedAt);

			const filtered = filter === 'all' ? visible : visible.filter((g) => g.status === filter);

			const items = filtered.map((g) => ({
				id: g.id,
				title: g.title,
				description: g.description,
				moduleId: g.moduleId,
				status: g.status,
				current: g.currentValue,
				target: g.target.value,
				period: g.target.period,
				comparison: g.target.comparison,
				percent:
					g.target.comparison === 'gte'
						? Math.min(Math.round((g.currentValue / g.target.value) * 100), 100)
						: g.currentValue <= g.target.value
							? 100
							: Math.max(
									0,
									Math.round((1 - (g.currentValue - g.target.value) / g.target.value) * 100)
								),
			}));

			return {
				success: true,
				data: items,
				message: `${items.length} Ziele (${filter}): ${items.map((g) => `${g.title} ${g.current}/${g.target}`).join(', ')}`,
			};
		},
	},

	{
		name: 'get_goal_progress',
		module: 'goals',
		description:
			'Gibt den detaillierten Fortschritt eines einzelnen Ziels zurueck, inklusive Metrik-Details und Periodeninfo.',
		parameters: [{ name: 'goalId', type: 'string', description: 'ID des Ziels', required: true }],
		async execute(params) {
			const goalId = params.goalId as string;
			const goal = await db.table<LocalGoal>(TABLE).get(goalId);
			if (!goal || goal.deletedAt) {
				return { success: false, message: `Ziel ${goalId} nicht gefunden` };
			}

			const reached =
				goal.target.comparison === 'gte'
					? goal.currentValue >= goal.target.value
					: goal.currentValue <= goal.target.value;

			return {
				success: true,
				data: {
					id: goal.id,
					title: goal.title,
					description: goal.description,
					moduleId: goal.moduleId,
					status: goal.status,
					current: goal.currentValue,
					target: goal.target.value,
					period: goal.target.period,
					comparison: goal.target.comparison,
					periodStart: goal.currentPeriodStart,
					reached,
					metric: goal.metric,
				},
				message: `${goal.title}: ${goal.currentValue}/${goal.target.value} (${goal.target.period}) — ${reached ? 'erreicht' : 'offen'}`,
			};
		},
	},

	{
		name: 'create_goal',
		module: 'goals',
		description:
			'Erstellt ein neues Ziel. Kann entweder ein Template verwenden (templateId) oder ein benutzerdefiniertes Ziel erstellen. Verfuegbare Templates: tpl-water-daily, tpl-tasks-daily, tpl-meals-daily, tpl-calories-daily, tpl-places-weekly, tpl-coffee-limit.',
		parameters: [
			{
				name: 'templateId',
				type: 'string',
				description:
					'ID eines Templates (z.B. "tpl-water-daily"). Wenn gesetzt, werden andere Felder ignoriert.',
				required: false,
			},
			{
				name: 'title',
				type: 'string',
				description: 'Titel des Ziels (nur fuer benutzerdefinierte Ziele)',
				required: false,
			},
			{
				name: 'description',
				type: 'string',
				description: 'Beschreibung',
				required: false,
			},
			{
				name: 'targetValue',
				type: 'number',
				description: 'Zielwert (z.B. 8 fuer "8 Glaeser Wasser")',
				required: false,
			},
			{
				name: 'period',
				type: 'string',
				description: 'Zeitraum',
				required: false,
				enum: ['day', 'week', 'month'],
			},
			{
				name: 'comparison',
				type: 'string',
				description: 'Vergleich: gte = mindestens, lte = hoechstens',
				required: false,
				enum: ['gte', 'lte'],
			},
			{
				name: 'eventType',
				type: 'string',
				description:
					'Domain-Event zum Zaehlen (z.B. "DrinkLogged", "TaskCompleted", "WorkoutFinished")',
				required: false,
			},
			{
				name: 'moduleId',
				type: 'string',
				description: 'Zugehoeriges Modul (z.B. "drink", "todo", "body")',
				required: false,
			},
		],
		async execute(params) {
			// Template-based creation
			const templateId = params.templateId as string | undefined;
			if (templateId) {
				const template = GOAL_TEMPLATES.find((t) => t.id === templateId);
				if (!template) {
					return { success: false, message: `Template "${templateId}" nicht gefunden` };
				}
				const goal = await goalStore.createFromTemplate(template);
				return {
					success: true,
					data: { id: goal.id, title: goal.title },
					message: `Ziel "${goal.title}" aus Template erstellt`,
				};
			}

			// Custom goal creation
			const title = params.title as string | undefined;
			if (!title) {
				return { success: false, message: 'Entweder templateId oder title ist erforderlich' };
			}

			const eventType = params.eventType as string | undefined;
			if (!eventType) {
				return {
					success: false,
					message: 'eventType ist fuer benutzerdefinierte Ziele erforderlich',
				};
			}

			const goal = await goalStore.create({
				title,
				description: params.description as string | undefined,
				moduleId: (params.moduleId as string) ?? 'general',
				metric: {
					source: 'event_count',
					eventType,
				},
				target: {
					value: (params.targetValue as number) ?? 1,
					period: (params.period as 'day' | 'week' | 'month') ?? 'day',
					comparison: (params.comparison as 'gte' | 'lte') ?? 'gte',
				},
			});

			return {
				success: true,
				data: { id: goal.id, title: goal.title },
				message: `Ziel "${goal.title}" erstellt`,
			};
		},
	},

	{
		name: 'pause_goal',
		module: 'goals',
		description: 'Pausiert ein aktives Ziel. Kann spaeter wieder fortgesetzt werden.',
		parameters: [{ name: 'goalId', type: 'string', description: 'ID des Ziels', required: true }],
		async execute(params) {
			const goalId = params.goalId as string;
			await goalStore.pause(goalId);
			return { success: true, message: `Ziel ${goalId} pausiert` };
		},
	},

	{
		name: 'resume_goal',
		module: 'goals',
		description: 'Setzt ein pausiertes Ziel fort.',
		parameters: [{ name: 'goalId', type: 'string', description: 'ID des Ziels', required: true }],
		async execute(params) {
			const goalId = params.goalId as string;
			await goalStore.resume(goalId);
			return { success: true, message: `Ziel ${goalId} fortgesetzt` };
		},
	},

	{
		name: 'complete_goal',
		module: 'goals',
		description: 'Markiert ein Ziel als abgeschlossen.',
		parameters: [{ name: 'goalId', type: 'string', description: 'ID des Ziels', required: true }],
		async execute(params) {
			const goalId = params.goalId as string;
			await goalStore.complete(goalId);
			return { success: true, message: `Ziel ${goalId} abgeschlossen` };
		},
	},
];
