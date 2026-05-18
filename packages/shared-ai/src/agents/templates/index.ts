/**
 * Agent-Templates — canonical set of pre-configured agents the user can
 * apply from the gallery in `/agents/templates`.
 *
 * Adding a new template: drop a new file next to `research.ts`,
 * `context.ts`, `today.ts`, export the `AgentTemplate` constant, and
 * add it to the `ALL_TEMPLATES` array below.
 */

import { researchTemplate } from './research';
import { contextTemplate } from './context';
import { todayTemplate } from './today';
import { calmnessTemplate } from './calmness';
import { fitnessTemplate } from './fitness';
import { deepWorkTemplate } from './deep-work';
import { eventScoutTemplate } from './event-scout';

export type {
	// Generalised names (T1 of workbench-templates plan):
	WorkbenchTemplate,
	WorkbenchTemplateAgentPart,
	WorkbenchTemplateScenePart,
	WorkbenchTemplateSceneApp,
	WorkbenchTemplateMissionPart,
	WorkbenchTemplateSeedItem,
	WorkbenchTemplateCategory,
	// Pre-T1 aliases:
	AgentTemplate,
	AgentTemplateAgentPart,
	AgentTemplateScenePart,
	AgentTemplateSceneApp,
	AgentTemplateMissionPart,
} from './types';

export const ALL_TEMPLATES = [
	researchTemplate,
	contextTemplate,
	todayTemplate,
	calmnessTemplate,
	fitnessTemplate,
	deepWorkTemplate,
	eventScoutTemplate,
] as const;

export {
	researchTemplate,
	contextTemplate,
	todayTemplate,
	calmnessTemplate,
	fitnessTemplate,
	deepWorkTemplate,
	eventScoutTemplate,
};

/** Lookup helper — returns the template matching the given id, or
 *  undefined. Useful for deep-links `/agents/templates?pick=research`. */
export function getTemplateById(id: string): (typeof ALL_TEMPLATES)[number] | undefined {
	return ALL_TEMPLATES.find((t) => t.id === id);
}
