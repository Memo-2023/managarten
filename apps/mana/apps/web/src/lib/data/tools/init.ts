/**
 * Tool initialization — Registers all module tools.
 * Call once at app startup.
 */

import { registerTools } from './registry';
import { todoTools } from '$lib/modules/todo/tools';
import { calendarTools } from '$lib/modules/calendar/tools';
import { drinkTools } from '$lib/modules/drink/tools';
import { placesTools } from '$lib/modules/places/tools';
import { habitsTools } from '$lib/modules/habits/tools';
import { journalTools } from '$lib/modules/journal/tools';
import { notesTools } from '$lib/modules/notes/tools';
import { contactsTools } from '$lib/modules/contacts/tools';
import { bodyTools } from '$lib/modules/body/tools';
import { financeTools } from '$lib/modules/finance/tools';
import { dreamsTools } from '$lib/modules/dreams/tools';
import { timesTools } from '$lib/modules/times/tools';
import { socialEventsTools } from '$lib/modules/events/tools';
import { storageTools } from '$lib/modules/storage/tools';
import { chatTools } from '$lib/modules/chat/tools';
import { skilltreeTools } from '$lib/modules/skilltree/tools';
import { periodTools } from '$lib/modules/period/tools';
import { firstsTools } from '$lib/modules/firsts/tools';
import { lastsTools } from '$lib/modules/lasts/tools';
import { guidesTools } from '$lib/modules/guides/tools';
import { inventoryTools } from '$lib/modules/inventory/tools';
import { newsResearchTools } from '$lib/modules/news-research/tools';
import { recipesTools } from '$lib/modules/recipes/tools';
import { questionsTools } from '$lib/modules/questions/tools';
import { meditateTools } from '$lib/modules/meditate/tools';
import { sleepTools } from '$lib/modules/sleep/tools';
import { mydayTools } from '$lib/modules/myday/tools';
import { goalsTools } from '$lib/modules/goals/tools';
import { moodTools } from '$lib/modules/mood/tools';
import { wishesTools } from '$lib/modules/wishes/tools';
import { wetterTools } from '$lib/modules/wetter/tools';
import { quizTools } from '$lib/modules/quiz/tools';
import { invoicesTools } from '$lib/modules/invoices/tools';
import { libraryTools } from '$lib/modules/library/tools';
import { broadcastTools } from '$lib/modules/broadcasts/tools';
import { websiteTools } from '$lib/modules/website/tools';
import { writingTools } from '$lib/modules/writing/tools';
import { augurTools } from '$lib/modules/augur/tools';
import { formsTools } from '$lib/modules/forms/tools';

let initialized = false;

export function initTools(): void {
	if (initialized) return;
	registerTools(todoTools);
	registerTools(calendarTools);
	registerTools(drinkTools);
	registerTools(placesTools);
	registerTools(habitsTools);
	registerTools(journalTools);
	registerTools(notesTools);
	registerTools(contactsTools);
	registerTools(bodyTools);
	registerTools(financeTools);
	registerTools(dreamsTools);
	registerTools(timesTools);
	registerTools(socialEventsTools);
	registerTools(storageTools);
	registerTools(chatTools);
	registerTools(skilltreeTools);
	registerTools(periodTools);
	registerTools(firstsTools);
	registerTools(lastsTools);
	registerTools(guidesTools);
	registerTools(inventoryTools);
	registerTools(newsResearchTools);
	registerTools(recipesTools);
	registerTools(questionsTools);
	registerTools(meditateTools);
	registerTools(sleepTools);
	registerTools(mydayTools);
	registerTools(goalsTools);
	registerTools(moodTools);
	registerTools(wishesTools);
	registerTools(wetterTools);
	registerTools(quizTools);
	registerTools(invoicesTools);
	registerTools(libraryTools);
	registerTools(broadcastTools);
	registerTools(websiteTools);
	registerTools(writingTools);
	registerTools(augurTools);
	registerTools(formsTools);
	initialized = true;
}
