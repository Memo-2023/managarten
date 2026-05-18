<!--
  Event Stream — Live feed of domain events from all modules.
  Shows what's happening across the system in real-time.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { eventBus } from '$lib/data/events/event-bus';
	import { queryEvents } from '$lib/data/events/event-store';
	import type { DomainEvent } from '$lib/data/events/types';
	import {
		CheckCircle,
		CalendarBlank,
		Drop,
		MapPin,
		Lightning,
		Robot,
		ChatCircle,
	} from '@mana/shared-icons';

	let events = $state<DomainEvent[]>([]);
	let unsubscribe: (() => void) | null = null;

	const EVENT_ICONS: Record<string, { icon: typeof CheckCircle; color: string }> = {
		TaskCreated: { icon: CheckCircle, color: '#10B981' },
		TaskCompleted: { icon: CheckCircle, color: '#6366F1' },
		TaskDeleted: { icon: CheckCircle, color: '#EF4444' },
		CalendarEventCreated: { icon: CalendarBlank, color: '#F59E0B' },
		CalendarEventDeleted: { icon: CalendarBlank, color: '#EF4444' },
		DrinkLogged: { icon: Drop, color: '#3B82F6' },
		DrinkEntryDeleted: { icon: Drop, color: '#EF4444' },
		PlaceVisited: { icon: MapPin, color: '#A855F7' },
		PlaceCreated: { icon: MapPin, color: '#10B981' },
		CompanionConversationStarted: { icon: ChatCircle, color: '#8B5CF6' },
		CompanionMessageSent: { icon: ChatCircle, color: '#A78BFA' },
		CompanionToolCalled: { icon: Robot, color: '#6366F1' },
	};

	const EVENT_LABELS: Record<string, (p: Record<string, unknown>) => string> = {
		TaskCreated: (p) => `Task erstellt: "${p.title}"`,
		TaskCompleted: (p) => `Task erledigt: "${p.title}"`,
		TaskUncompleted: (p) => `Task wiedergeoeffnet: "${p.title}"`,
		TaskDeleted: (p) => `Task geloescht: "${p.title}"`,
		SubtasksUpdated: (p) => `Subtasks: ${p.completed}/${p.total}`,
		CalendarEventCreated: (p) => `Termin: "${p.title}"`,
		CalendarEventUpdated: () => 'Termin aktualisiert',
		CalendarEventDeleted: (p) => `Termin geloescht: "${p.title}"`,
		DrinkLogged: (p) => `${p.quantityMl}ml ${p.name ?? p.drinkType}`,
		DrinkEntryDeleted: (p) => `Drink geloescht (${p.quantityMl}ml)`,
		DrinkEntryUndone: () => 'Letzter Drink rueckgaengig',
		PlaceCreated: (p) => `Neuer Ort: "${p.name}"`,
		PlaceVisited: (p) => `Besuch: "${p.name}" (${p.visitCount}x)`,
		PlaceDeleted: (p) => `Ort geloescht: "${p.name}"`,
		LocationLogged: () => 'Standort erfasst',
		TrackingStarted: () => 'Tracking gestartet',
		TrackingStopped: () => 'Tracking gestoppt',
		GoalReached: (p) => `Ziel erreicht: "${p.title}"`,
		CompanionConversationStarted: (p) =>
			`Companion-Chat gestartet${p.title ? `: "${p.title}"` : ''}`,
		CompanionMessageSent: (p) =>
			`${p.role === 'user' ? 'Du' : 'Companion'}: ${p.contentLength} Zeichen`,
		CompanionToolCalled: (p) => `Tool: ${p.tool}${p.success ? '' : ' (Fehler)'} (${p.latencyMs}ms)`,
	};

	function formatTime(iso: string): string {
		try {
			return new Date(iso).toLocaleTimeString('de-DE', {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
			});
		} catch {
			return iso.slice(11, 19);
		}
	}

	function getLabel(event: DomainEvent): string {
		const fn = EVENT_LABELS[event.type];
		if (fn) return fn(event.payload as Record<string, unknown>);
		return event.type;
	}

	onMount(async () => {
		// Load recent events
		const recent = await queryEvents({ limit: 50 });
		events = recent;

		// Subscribe to live events
		unsubscribe = eventBus.onAny((event) => {
			events = [event, ...events].slice(0, 100);
		});
	});

	onDestroy(() => {
		unsubscribe?.();
	});
</script>

<div class="stream">
	{#if events.length === 0}
		<div class="empty">Noch keine Events. Erstelle Daten in Todo, Kalender, Drink oder Food.</div>
	{:else}
		{#each events as event (event.meta.id)}
			{@const iconDef = EVENT_ICONS[event.type] ?? { icon: Lightning, color: '#6B7280' }}
			{@const IconComp = iconDef.icon}
			<div class="event-row">
				<div class="event-icon" style:color={iconDef.color}>
					<IconComp size={14} weight="fill" />
				</div>
				<div class="event-content">
					<span class="event-label">{getLabel(event)}</span>
					<span class="event-meta">{event.meta.appId} · {formatTime(event.meta.timestamp)}</span>
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	.stream {
		display: flex;
		flex-direction: column;
		padding: 0.5rem;
	}

	.empty {
		font-size: 0.8125rem;
		color: hsl(var(--color-muted-foreground));
		text-align: center;
		padding: 2rem 1rem;
	}

	.event-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		border-radius: 0.375rem;
		transition: background 0.1s;
	}

	.event-row:hover {
		background: hsl(var(--color-muted) / 0.1);
	}

	.event-icon {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: hsl(var(--color-muted) / 0.15);
		margin-top: 1px;
	}

	.event-content {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
		min-width: 0;
	}

	.event-label {
		font-size: 0.8125rem;
		color: hsl(var(--color-foreground));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.event-meta {
		font-size: 0.6875rem;
		color: hsl(var(--color-muted-foreground));
	}
</style>
