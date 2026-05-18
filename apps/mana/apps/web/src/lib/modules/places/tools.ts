/**
 * Places Tools — LLM-accessible operations for location tracking.
 */

import type { ModuleTool } from '$lib/data/tools/types';
import { placesStore } from './stores/places.svelte';
import { trackingStore } from './stores/tracking.svelte';
import { placeTable } from './collections';
import { decryptRecords } from '$lib/data/crypto';
import { toPlace } from './queries';
import type { LocalPlace, PlaceCategory } from './types';

export const placesTools: ModuleTool[] = [
	{
		name: 'create_place',
		module: 'places',
		description: 'Erstellt einen neuen Ort',
		parameters: [
			{ name: 'name', type: 'string', description: 'Name des Ortes', required: true },
			{ name: 'latitude', type: 'number', description: 'Breitengrad', required: true },
			{ name: 'longitude', type: 'number', description: 'Laengengrad', required: true },
			{
				name: 'category',
				type: 'string',
				description: 'Kategorie',
				required: false,
				enum: [
					'home',
					'work',
					'shopping',
					'sport',
					'culture',
					'nature',
					'transport',
					'health',
					'education',
					'nightlife',
					'other',
				],
			},
			{ name: 'address', type: 'string', description: 'Adresse', required: false },
		],
		async execute(params) {
			const place = await placesStore.createPlace({
				name: params.name as string,
				latitude: params.latitude as number,
				longitude: params.longitude as number,
				category: params.category as PlaceCategory | undefined,
				address: params.address as string | undefined,
			});
			return { success: true, data: place, message: `Ort "${params.name}" erstellt` };
		},
	},
	{
		name: 'visit_place',
		module: 'places',
		description: 'Vermerkt einen Besuch an einem bereits erfassten Ort',
		parameters: [{ name: 'placeId', type: 'string', description: 'ID des Ortes', required: true }],
		async execute(params) {
			await placesStore.recordVisit(params.placeId as string);
			return { success: true, message: 'Besuch registriert' };
		},
	},
	{
		name: 'get_places',
		module: 'places',
		description: 'Gibt alle gespeicherten Orte zurueck',
		parameters: [],
		async execute() {
			const all = await placeTable.toArray();
			const active = all.filter((p) => !p.deletedAt && !p.isArchived);
			const decrypted = await decryptRecords<LocalPlace>('places', active);
			const places = decrypted.map(toPlace);
			return {
				success: true,
				data: places.map((p) => ({
					id: p.id,
					name: p.name,
					category: p.category,
					visitCount: p.visitCount,
				})),
				message: `${places.length} Orte gespeichert`,
			};
		},
	},
	{
		name: 'get_current_location',
		module: 'places',
		description: 'Gibt die aktuelle GPS-Position zurueck (erfordert Standort-Berechtigung)',
		parameters: [],
		async execute() {
			const pos = await trackingStore.getCurrentPosition();
			if (!pos) {
				return { success: false, message: 'Standort nicht verfuegbar' };
			}
			return {
				success: true,
				data: {
					latitude: pos.coords.latitude,
					longitude: pos.coords.longitude,
					accuracy: pos.coords.accuracy,
				},
				message: `Standort: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
			};
		},
	},
];
