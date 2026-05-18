<script lang="ts">
	/**
	 * URL-style fallback for the pure-package inspector — the app-side
	 * override adds a board picker that queries Dexie.
	 */
	import type { BlockInspectorProps } from '../types';
	import type { ModuleEmbedProps } from './schema';

	let { block, onChange }: BlockInspectorProps<ModuleEmbedProps> = $props();
</script>

<div class="wb-inspector">
	<label class="wb-field">
		<span>Quelle</span>
		<select
			value={block.props.source}
			onchange={(e) => onChange({ source: e.currentTarget.value as ModuleEmbedProps['source'] })}
		>
			<option value="picture.board">Picture-Board</option>
			<option value="library.entries">Bibliothek</option>
			<option value="calendar.events">Kalender (Termine)</option>
			<option value="todo.tasks">Todos</option>
			<option value="goals.goals">Ziele</option>
			<option value="places.places">Orte</option>
			<option value="recipes.recipes">Rezepte</option>
			<option value="wardrobe.outfits">Wardrobe (Outfits)</option>
			<option value="comic.stories">Comics</option>
			<option value="habits.habits">Habits</option>
			<option value="quiz.quizzes">Quizze</option>
			<option value="events.socialEvents">Events (RSVP)</option>
			<option value="cards.decks">Karten (Decks)</option>
			<option value="presi.decks">Präsentationen</option>
			<option value="augur.entries">Augur (Omen / Wahrsagungen)</option>
		</select>
	</label>

	<label class="wb-field">
		<span>Quellen-ID</span>
		<input
			type="text"
			value={block.props.sourceId}
			oninput={(e) => onChange({ sourceId: e.currentTarget.value })}
			placeholder="Board-ID oder leer für 'alle'"
		/>
	</label>

	<label class="wb-field">
		<span>Titel (optional)</span>
		<input
			type="text"
			value={block.props.title}
			oninput={(e) => onChange({ title: e.currentTarget.value })}
		/>
	</label>

	<div class="wb-row">
		<label class="wb-field">
			<span>Layout</span>
			<select
				value={block.props.layout}
				onchange={(e) => onChange({ layout: e.currentTarget.value as ModuleEmbedProps['layout'] })}
			>
				<option value="grid">Grid</option>
				<option value="list">Liste</option>
			</select>
		</label>

		<label class="wb-field">
			<span>Max. Einträge</span>
			<input
				type="number"
				min="1"
				max="48"
				value={block.props.maxItems}
				oninput={(e) => onChange({ maxItems: parseInt(e.currentTarget.value, 10) || 12 })}
			/>
		</label>
	</div>
</div>

<style>
	.wb-inspector {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.wb-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.wb-field > span {
		font-size: 0.75rem;
		font-weight: 500;
		opacity: 0.7;
	}
	.wb-field input,
	.wb-field select {
		padding: 0.4rem 0.6rem;
		border-radius: 0.375rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		font-size: 0.8125rem;
	}
	.wb-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
</style>
