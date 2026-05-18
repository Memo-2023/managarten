/**
 * Module barrel — call `registerAllModules()` at process startup to
 * populate the registry with every bundled tool.
 *
 * Adding a new module:
 *   1. Create `src/modules/<module>.ts` with one or more `ToolSpec` exports
 *      and a `register<Module>Tools()` function that calls `registerTool()`
 *      for each.
 *   2. Import + call it from this file.
 *   3. Extend `ModuleId` in `../types.ts`.
 */

import { registerHabitsTools } from './habits.ts';
import { registerJournalTools } from './journal.ts';
import { registerMeTools } from './me.ts';
import { registerMoodTools } from './mood.ts';
import { registerNotesTools } from './notes.ts';
import { registerSpacesTools } from './spaces.ts';
import { registerTodoTools } from './todo.ts';
import { registerComicTools } from './comic.ts';
import { registerAugurTools } from './augur.ts';

export function registerAllModules(): void {
	registerHabitsTools();
	registerJournalTools();
	registerMeTools();
	registerMoodTools();
	registerNotesTools();
	registerSpacesTools();
	registerTodoTools();
	registerComicTools();
	registerAugurTools();
}

export {
	registerHabitsTools,
	registerJournalTools,
	registerMeTools,
	registerMoodTools,
	registerNotesTools,
	registerSpacesTools,
	registerTodoTools,
	registerComicTools,
	registerAugurTools,
};
