---
title: 'Test Coverage Expansion: Contacts & Todo'
description: 'Umfassende Unit Tests für Contacts (62 Tests) und Todo (39 Tests) Web Apps. Cross-App Test Coverage mit Vitest erweitert und ungenutzten Code entfernt.'
date: 2026-03-18
author: 'Till Schneider'
category: 'update'
tags: ['testing', 'unit-tests', 'contacts', 'todo', 'calendar', 'vitest', 'coverage']
featured: false
commits: 5
readTime: 6
stats:
  filesChanged: 42
  linesAdded: 3200
  linesRemoved: 890
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 5
workingHours:
  start: '2026-03-18T11:00'
  end: '2026-03-19T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Fokussierter Tag mit **5 Commits** für Test Coverage und Code Cleanup:

- **Contacts Web** - 62 Unit Tests für Stores, Utils und API Client
- **Todo Web** - 39 Unit Tests, d3-force entfernt, Default Title Fix
- **Cross-App Coverage** - Calendar, Contacts und Todo Test-Infrastruktur
- **Code Cleanup** - Ungenutzte Network View Remnants entfernt

---

## Contacts Web: 62 Unit Tests

Umfassende Test Coverage für die Contacts Web App mit Vitest.

### Test Suites

| Suite             | Tests | Beschreibung                         |
| ----------------- | ----- | ------------------------------------ |
| **Contact Store** | 18    | CRUD Operationen, Filtering, Sorting |
| **Group Store**   | 12    | Gruppenverwaltung, Mitglieder        |
| **API Client**    | 15    | HTTP Requests, Error Handling, Retry |
| **Utils**         | 10    | Formatierung, Validierung, Search    |
| **Types**         | 7     | Type Guards, Transformations         |

### Store Test Beispiel

```typescript
describe('contactStore', () => {
	it('should filter contacts by search term', () => {
		const store = createContactStore();
		store.setContacts([
			{ id: '1', name: 'Alice Schmidt', email: 'alice@example.com' },
			{ id: '2', name: 'Bob Mueller', email: 'bob@example.com' },
			{ id: '3', name: 'Charlie Schmidt', email: 'charlie@example.com' },
		]);

		store.setSearchTerm('Schmidt');

		expect(store.filteredContacts).toHaveLength(2);
		expect(store.filteredContacts.map((c) => c.name)).toEqual(['Alice Schmidt', 'Charlie Schmidt']);
	});

	it('should handle API errors gracefully', async () => {
		vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

		const store = createContactStore();
		const result = await store.loadContacts();

		expect(result.ok).toBe(false);
		expect(result.error?.code).toBe('NETWORK_ERROR');
	});
});
```

### API Client Tests

```typescript
describe('contactsApiClient', () => {
	it('should retry on 503 errors', async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));

		const result = await apiClient.getContacts();

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(result.ok).toBe(true);
	});
});
```

---

## Todo Web: 39 Unit Tests

Unit Tests für die Todo App mit zusätzlichem Code Cleanup.

### Test Suites

| Suite          | Tests | Beschreibung                    |
| -------------- | ----- | ------------------------------- |
| **Todo Store** | 14    | CRUD, Completion, Reordering    |
| **List Store** | 8     | Listen-Management, Default List |
| **Utils**      | 9     | Date Helpers, Priority Sorting  |
| **Components** | 8     | Render Tests, User Interactions |

### d3-force Entfernung

Die `d3-force` Dependency wurde entfernt. Sie war ursprünglich für eine Graph-Visualisierung geplant, die nie implementiert wurde.

```diff
  "dependencies": {
-   "d3-force": "^3.0.0",
-   "@types/d3-force": "^3.0.0",
    "svelte": "^5.0.0",
  }
```

**Impact:** Bundle Size um ~45 KB reduziert.

### Default Title Fix

Neue Todos ohne Titel erhielten `undefined` statt einen leeren String. Das führte zu Darstellungsproblemen in der Liste.

```diff
  function createTodo(input: Partial<Todo>): Todo {
    return {
      id: crypto.randomUUID(),
-     title: input.title,
+     title: input.title ?? '',
      completed: false,
      priority: input.priority ?? 'medium',
      createdAt: new Date().toISOString(),
    };
  }
```

---

## Cross-App Test Infrastructure

### Vitest Konfiguration

Einheitliche Vitest-Konfiguration für alle Web Apps:

```typescript
// vitest.config.ts (shared pattern)
export default defineConfig({
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{ts,js}'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: ['src/lib/**/*.ts'],
			exclude: ['**/*.d.ts', '**/*.test.ts'],
		},
		setupFiles: ['./src/test/setup.ts'],
	},
});
```

### Coverage Übersicht

| App          | Tests | Statements | Branches | Functions |
| ------------ | ----- | ---------- | -------- | --------- |
| **Contacts** | 62    | 78%        | 72%      | 81%       |
| **Todo**     | 39    | 74%        | 68%      | 76%       |
| **Calendar** | 26    | 65%        | 58%      | 69%       |

### Test Commands

```bash
# Einzelne App testen
pnpm --filter @contacts/web test
pnpm --filter @todo/web test

# Mit Coverage Report
pnpm --filter @contacts/web test -- --coverage

# Alle Web App Tests
pnpm turbo run test --filter="*/web"
```

---

## Contacts: Network View Cleanup

Ungenutzte Remnants der geplanten Network-View (Graph-Visualisierung von Kontakt-Beziehungen) wurden entfernt.

### Entfernte Dateien

- `src/lib/components/NetworkView.svelte`
- `src/lib/stores/networkStore.ts`
- `src/lib/utils/graphLayout.ts`
- `src/lib/types/network.ts`

### Entfernte Dependencies

```diff
- "d3-force": "^3.0.0",
- "@types/d3-force": "^3.0.10",
- "d3-selection": "^3.0.0",
```

---

## Contacts: Production Config Fix

Die `PUBLIC_TODO_BACKEND_URL` fehlte in der Production-Konfiguration der Contacts Web App. Das führte dazu, dass die Todo-Integration in Production nicht funktionierte.

```diff
  # .env.production
  PUBLIC_CONTACTS_BACKEND_URL=https://contacts-api.mana.how
+ PUBLIC_TODO_BACKEND_URL=https://todo-api.mana.how
```

---

## Zusammenfassung

| Bereich            | Commits | Highlights                  |
| ------------------ | ------- | --------------------------- |
| **Contacts Tests** | 1       | 62 Unit Tests, Stores + API |
| **Todo Tests**     | 1       | 39 Tests, d3-force entfernt |
| **Cross-App**      | 1       | Vitest Config, Coverage     |
| **Cleanup**        | 1       | Network View Remnants       |
| **Config**         | 1       | Production URL Fix          |

---

## Nächste Schritte

1. **Coverage > 80%** - Verbleibende Lücken in Stores schließen
2. **Calendar Tests** - Coverage auf 80% bringen
3. **CI Integration** - Test Coverage Reports in PR Checks
4. **E2E Tests** - Contacts und Todo Playwright Tests
