# Cardecky: Migration zu PostgreSQL + Drizzle ORM

## Übersicht

Dieses Dokument beschreibt die Migration von Cardecky von Supabase zu einer selbst-gehosteten PostgreSQL-Datenbank mit Drizzle ORM.

---

## Aktuelle Architektur

```
┌─────────────────┐     ┌─────────────────┐
│  Cardecky Web   │     │ Cardecky Mobile │
│   (SvelteKit)   │     │     (Expo)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   Cardecky Backend    │
         │      (NestJS)         │
         └───────────┬───────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                ▼
┌────────┐    ┌──────────┐    ┌──────────┐
│Supabase│    │Mana │    │  OpenAI  │
│   DB   │    │  (Auth)  │    │   API    │
└────────┘    └──────────┘    └──────────┘
```

---

## Ziel-Architektur

```
┌─────────────────┐     ┌─────────────────┐
│  Cardecky Web   │     │ Cardecky Mobile │
│   (SvelteKit)   │     │     (Expo)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   Cardecky Backend    │
         │  (NestJS + Drizzle)   │
         └───────────┬───────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                ▼
┌────────┐    ┌──────────┐    ┌──────────┐
│ PostgreSQL │ │Mana │  │  OpenAI  │
│  (Self)    │ │  (Auth)  │  │   API    │
└────────────┘ └──────────┘  └──────────┘
```

---

## Datenbank-Schema

### Tabellen

#### 1. `decks`

```sql
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,  -- Mana User ID
  title VARCHAR(255) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  featured_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decks_user_id ON decks(user_id);
CREATE INDEX idx_decks_is_public ON decks(is_public);
CREATE INDEX idx_decks_is_featured ON decks(is_featured);
```

#### 2. `cards`

```sql
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  title VARCHAR(255),
  content JSONB NOT NULL,
  card_type VARCHAR(20) NOT NULL CHECK (card_type IN ('text', 'flashcard', 'quiz', 'mixed')),
  ai_model VARCHAR(100),
  ai_prompt TEXT,
  version INTEGER DEFAULT 1,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cards_deck_id ON cards(deck_id);
CREATE INDEX idx_cards_position ON cards(deck_id, position);
```

#### 3. `study_sessions`

```sql
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('all', 'new', 'review', 'favorites', 'random')),
  total_cards INTEGER NOT NULL DEFAULT 0,
  completed_cards INTEGER NOT NULL DEFAULT 0,
  correct_cards INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_spent_seconds INTEGER DEFAULT 0
);

CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_deck_id ON study_sessions(deck_id);
```

#### 4. `card_progress`

```sql
CREATE TABLE card_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  ease_factor DECIMAL(4,2) DEFAULT 2.5,
  interval INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  last_reviewed TIMESTAMPTZ,
  next_review TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'learning', 'review', 'relearning')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

CREATE INDEX idx_card_progress_user_id ON card_progress(user_id);
CREATE INDEX idx_card_progress_next_review ON card_progress(next_review);
```

#### 5. `deck_templates`

```sql
CREATE TABLE deck_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  template_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,
  popularity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deck_templates_category ON deck_templates(category);
CREATE INDEX idx_deck_templates_is_active ON deck_templates(is_active);
```

#### 6. `ai_generations`

```sql
CREATE TABLE ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  deck_id UUID REFERENCES decks(id) ON DELETE SET NULL,
  function_name VARCHAR(100) NOT NULL,
  prompt TEXT NOT NULL,
  model VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_generations_user_id ON ai_generations(user_id);
CREATE INDEX idx_ai_generations_status ON ai_generations(status);
```

#### 7. `user_stats` (für Leaderboard)

```sql
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY,
  total_wins INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_cards_studied INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  average_accuracy DECIMAL(5,2) DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_study_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Drizzle Schema

### Dateistruktur

```
cards/
├── packages/
│   └── database/                 # Neues shared database package
│       ├── src/
│       │   ├── schema/
│       │   │   ├── decks.ts
│       │   │   ├── cards.ts
│       │   │   ├── studySessions.ts
│       │   │   ├── cardProgress.ts
│       │   │   ├── deckTemplates.ts
│       │   │   ├── aiGenerations.ts
│       │   │   ├── userStats.ts
│       │   │   └── index.ts
│       │   ├── client.ts
│       │   ├── migrate.ts
│       │   └── index.ts
│       ├── drizzle/
│       │   └── migrations/
│       ├── drizzle.config.ts
│       ├── package.json
│       └── tsconfig.json
```

### Schema-Definitionen (Drizzle)

#### `schema/decks.ts`

```typescript
import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const decks = pgTable('decks', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id').notNull(),  // text, not uuid - Better Auth uses non-UUID IDs
	title: varchar('title', { length: 255 }).notNull(),
	description: text('description'),
	coverImageUrl: text('cover_image_url'),
	isPublic: boolean('is_public').default(false),
	isFeatured: boolean('is_featured').default(false),
	featuredAt: timestamp('featured_at', { withTimezone: true }),
	settings: jsonb('settings').default({}),
	tags: text('tags').array().default([]),
	metadata: jsonb('metadata').default({}),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type Deck = typeof decks.$inferSelect;
export type NewDeck = typeof decks.$inferInsert;
```

#### `schema/cards.ts`

```typescript
import {
	pgTable,
	uuid,
	varchar,
	text,
	integer,
	boolean,
	timestamp,
	jsonb,
} from 'drizzle-orm/pg-core';
import { decks } from './decks';

export const cardTypeEnum = pgEnum('card_type', ['text', 'flashcard', 'quiz', 'mixed']);

export const cards = pgTable('cards', {
	id: uuid('id').primaryKey().defaultRandom(),
	deckId: uuid('deck_id')
		.notNull()
		.references(() => decks.id, { onDelete: 'cascade' }),
	position: integer('position').notNull().default(0),
	title: varchar('title', { length: 255 }),
	content: jsonb('content').notNull(),
	cardType: cardTypeEnum('card_type').notNull(),
	aiModel: varchar('ai_model', { length: 100 }),
	aiPrompt: text('ai_prompt'),
	version: integer('version').default(1),
	isFavorite: boolean('is_favorite').default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
```

#### `schema/index.ts`

```typescript
export * from './decks';
export * from './cards';
export * from './studySessions';
export * from './cardProgress';
export * from './deckTemplates';
export * from './aiGenerations';
export * from './userStats';

// Relations
export { decksRelations } from './decks';
export { cardsRelations } from './cards';
```

### Client Setup

#### `client.ts`

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// For connection pooling in serverless environments
const client = postgres(connectionString, {
	max: 10,
	idle_timeout: 20,
	connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
```

---

## Migrationsschritte

### Phase 1: Setup (Tag 1-2)

#### 1.1 PostgreSQL Server aufsetzen

```bash
# Option A: Railway.app (empfohlen für Staging)
# Erstelle neues Projekt auf railway.app
# Füge PostgreSQL Plugin hinzu

# Option B: Docker lokal
docker run -d \
  --name cards-postgres \
  -e POSTGRES_USER=cards \
  -e POSTGRES_PASSWORD=secure_password \
  -e POSTGRES_DB=cards \
  -p 5432:5432 \
  postgres:16-alpine

# Option C: Neon.tech (Serverless)
# Erstelle neues Projekt auf neon.tech
```

#### 1.2 Database Package erstellen

```bash
cd /Users/tillschneider/Documents/__00__Code/mana-monorepo
mkdir -p packages/cards-database
cd packages/cards-database
pnpm init
```

#### 1.3 Dependencies installieren

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit typescript @types/node
```

### Phase 2: Schema & Migration (Tag 2-3)

#### 2.1 Drizzle Schema erstellen

- Alle Tabellen wie oben definiert
- Relations definieren
- Indexes definieren

#### 2.2 Initial Migration generieren

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

#### 2.3 Daten von Supabase exportieren

```bash
# In Supabase Dashboard: SQL Editor
# Export alle Tabellen als CSV oder pg_dump

# Oder via CLI:
pg_dump -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  --data-only \
  --table=decks \
  --table=cards \
  --table=study_sessions \
  --table=card_progress \
  --table=deck_templates \
  --table=ai_generations \
  --table=user_stats \
  > cards_data.sql
```

### Phase 3: Backend Migration (Tag 3-5)

#### 3.1 Repository Pattern implementieren

```typescript
// repositories/deck.repository.ts
import { db } from '@cards/database';
import { decks, cards } from '@cards/database/schema';
import { eq, and, or, desc } from 'drizzle-orm';

export class DeckRepository {
	async findAllByUser(userId: string) {
		return db.query.decks.findMany({
			where: eq(decks.userId, userId),
			orderBy: desc(decks.updatedAt),
			with: {
				cards: true,
			},
		});
	}

	async findById(id: string) {
		return db.query.decks.findFirst({
			where: eq(decks.id, id),
			with: {
				cards: {
					orderBy: (cards, { asc }) => [asc(cards.position)],
				},
			},
		});
	}

	async findPublicAndUserDecks(userId: string) {
		return db.query.decks.findMany({
			where: or(
				eq(decks.userId, userId),
				and(eq(decks.isPublic, true), eq(decks.isFeatured, true))
			),
			orderBy: desc(decks.updatedAt),
		});
	}

	async create(data: NewDeck) {
		const [deck] = await db.insert(decks).values(data).returning();
		return deck;
	}

	async update(id: string, userId: string, data: Partial<NewDeck>) {
		const [deck] = await db
			.update(decks)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(decks.id, id), eq(decks.userId, userId)))
			.returning();
		return deck;
	}

	async delete(id: string, userId: string) {
		await db.delete(decks).where(and(eq(decks.id, id), eq(decks.userId, userId)));
	}
}
```

#### 3.2 Service Layer aktualisieren

```typescript
// services/deck.service.ts
import { DeckRepository } from '../repositories/deck.repository';

export class DeckService {
	constructor(private deckRepo = new DeckRepository()) {}

	async getUserDecks(userId: string) {
		return this.deckRepo.findPublicAndUserDecks(userId);
	}

	async getDeck(id: string) {
		return this.deckRepo.findById(id);
	}

	async createDeck(userId: string, data: CreateDeckInput) {
		return this.deckRepo.create({
			...data,
			userId,
		});
	}

	async updateDeck(id: string, userId: string, data: UpdateDeckInput) {
		return this.deckRepo.update(id, userId, data);
	}

	async deleteDeck(id: string, userId: string) {
		return this.deckRepo.delete(id, userId);
	}
}
```

### Phase 4: Frontend Migration (Tag 5-7)

#### 4.1 API Client erstellen (ersetzt Supabase SDK)

```typescript
// lib/api/client.ts
import { getToken } from '$lib/auth';

const API_URL = import.meta.env.VITE_API_URL;

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const token = getToken();

	const response = await fetch(`${API_URL}${endpoint}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` }),
			...options.headers,
		},
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.message || 'API Error');
	}

	return response.json();
}

export const api = {
	get: <T>(endpoint: string) => fetchApi<T>(endpoint),
	post: <T>(endpoint: string, data: unknown) =>
		fetchApi<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
	put: <T>(endpoint: string, data: unknown) =>
		fetchApi<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
	delete: <T>(endpoint: string) => fetchApi<T>(endpoint, { method: 'DELETE' }),
};
```

#### 4.2 Deck Store migrieren

```typescript
// stores/deckStore.svelte.ts
import { api } from '$lib/api/client';
import type { Deck, CreateDeckInput, UpdateDeckInput } from '$lib/types/deck';

function createDeckStore() {
	let decks = $state<Deck[]>([]);
	let currentDeck = $state<Deck | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	return {
		get decks() {
			return decks;
		},
		get currentDeck() {
			return currentDeck;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},

		async fetchDecks() {
			loading = true;
			error = null;
			try {
				decks = await api.get<Deck[]>('/api/decks');
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to fetch decks';
			} finally {
				loading = false;
			}
		},

		async fetchDeck(id: string) {
			loading = true;
			error = null;
			try {
				currentDeck = await api.get<Deck>(`/api/decks/${id}`);
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to fetch deck';
			} finally {
				loading = false;
			}
		},

		async createDeck(data: CreateDeckInput) {
			loading = true;
			error = null;
			try {
				const deck = await api.post<Deck>('/api/decks', data);
				decks = [deck, ...decks];
				return deck;
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to create deck';
				throw e;
			} finally {
				loading = false;
			}
		},

		async updateDeck(id: string, data: UpdateDeckInput) {
			loading = true;
			error = null;
			try {
				const deck = await api.put<Deck>(`/api/decks/${id}`, data);
				decks = decks.map((d) => (d.id === id ? deck : d));
				if (currentDeck?.id === id) currentDeck = deck;
				return deck;
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to update deck';
				throw e;
			} finally {
				loading = false;
			}
		},

		async deleteDeck(id: string) {
			loading = true;
			error = null;
			try {
				await api.delete(`/api/decks/${id}`);
				decks = decks.filter((d) => d.id !== id);
				if (currentDeck?.id === id) currentDeck = null;
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to delete deck';
				throw e;
			} finally {
				loading = false;
			}
		},
	};
}

export const deckStore = createDeckStore();
```

### Phase 5: Testing & Cutover (Tag 7-10)

#### 5.1 Integration Tests

```typescript
// tests/deck.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@cards/database';
import { decks } from '@cards/database/schema';
import { DeckService } from '../services/deck.service';

describe('DeckService', () => {
	const service = new DeckService();
	const testUserId = 'test-user-id';

	afterAll(async () => {
		await db.delete(decks).where(eq(decks.userId, testUserId));
	});

	it('should create a deck', async () => {
		const deck = await service.createDeck(testUserId, {
			title: 'Test Deck',
			description: 'A test deck',
		});

		expect(deck.id).toBeDefined();
		expect(deck.title).toBe('Test Deck');
	});

	it('should fetch user decks', async () => {
		const userDecks = await service.getUserDecks(testUserId);
		expect(userDecks.length).toBeGreaterThan(0);
	});
});
```

#### 5.2 Datenmigrations-Script

```typescript
// scripts/migrate-data.ts
import { db as newDb } from '@cards/database';
import { createClient } from '@supabase/supabase-js';
import { decks, cards } from '@cards/database/schema';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function migrateDecks() {
	console.log('Migrating decks...');

	const { data: supabaseDecks, error } = await supabase.from('decks').select('*');

	if (error) throw error;

	for (const deck of supabaseDecks) {
		await newDb
			.insert(decks)
			.values({
				id: deck.id,
				userId: deck.user_id,
				title: deck.title,
				description: deck.description,
				coverImageUrl: deck.cover_image_url,
				isPublic: deck.is_public,
				isFeatured: deck.is_featured,
				featuredAt: deck.featured_at,
				settings: deck.settings,
				tags: deck.tags,
				metadata: deck.metadata,
				createdAt: deck.created_at,
				updatedAt: deck.updated_at,
			})
			.onConflictDoNothing();
	}

	console.log(`Migrated ${supabaseDecks.length} decks`);
}

async function migrateCardecky() {
	console.log('Migrating cards...');

	const { data: supabaseCardecky, error } = await supabase.from('cards').select('*');

	if (error) throw error;

	for (const card of supabaseCardecky) {
		await newDb
			.insert(cards)
			.values({
				id: card.id,
				deckId: card.deck_id,
				position: card.position,
				title: card.title,
				content: card.content,
				cardType: card.card_type,
				aiModel: card.ai_model,
				aiPrompt: card.ai_prompt,
				version: card.version,
				isFavorite: card.is_favorite,
				createdAt: card.created_at,
				updatedAt: card.updated_at,
			})
			.onConflictDoNothing();
	}

	console.log(`Migrated ${supabaseCardecky.length} cards`);
}

async function main() {
	try {
		await migrateDecks();
		await migrateCardecky();
		// ... andere Tabellen
		console.log('Migration completed successfully!');
	} catch (error) {
		console.error('Migration failed:', error);
		process.exit(1);
	}
}

main();
```

---

## Zeitplan

| Phase | Beschreibung                | Dauer    | Status     |
| ----- | --------------------------- | -------- | ---------- |
| 1     | Setup (PostgreSQL, Package) | 1-2 Tage | ⬜ Pending |
| 2     | Schema & Migration          | 1-2 Tage | ⬜ Pending |
| 3     | Backend Migration           | 2-3 Tage | ⬜ Pending |
| 4     | Frontend Migration          | 2-3 Tage | ⬜ Pending |
| 5     | Testing & Cutover           | 2-3 Tage | ⬜ Pending |

**Gesamtdauer: ~10-13 Tage**

---

## Checkliste

### Pre-Migration

- [ ] PostgreSQL Server aufgesetzt
- [ ] Database Package erstellt
- [ ] Drizzle Schema definiert
- [ ] Initial Migration durchgeführt
- [ ] Supabase Daten exportiert

### Backend

- [ ] Repository Pattern implementiert
- [ ] DeckRepository
- [ ] CardRepository
- [ ] StudySessionRepository
- [ ] CardProgressRepository
- [ ] DeckTemplateRepository
- [ ] AIGenerationRepository
- [ ] UserStatsRepository
- [ ] Service Layer aktualisiert
- [ ] Controller aktualisiert
- [ ] Authorization Middleware (ersetzt RLS)

### Frontend

- [ ] API Client erstellt
- [ ] deckStore migriert
- [ ] Supabase imports entfernt
- [ ] Environment Variables aktualisiert

### Testing

- [ ] Unit Tests für Repositories
- [ ] Integration Tests für Services
- [ ] E2E Tests für API
- [ ] Manual Testing aller Features

### Cutover

- [ ] Daten migriert (Script ausgeführt)
- [ ] DNS/Environment umgestellt
- [ ] Rollback Plan dokumentiert
- [ ] Monitoring eingerichtet

---

## Rollback Plan

Falls kritische Probleme auftreten:

1. **Environment Variables zurücksetzen** auf Supabase
2. **Feature Flag** für alte Implementierung aktivieren
3. **DNS** auf alten Service zeigen lassen

Supabase-Daten bleiben während der Migration unberührt.

---

## Kosten nach Migration

| Service                | Geschätzte Kosten |
| ---------------------- | ----------------- |
| PostgreSQL (Railway)   | ~$5-20/Monat      |
| PostgreSQL (Neon Free) | $0/Monat          |
| Backup (optional)      | ~$5/Monat         |
| **Gesamt**             | **$5-25/Monat**   |

vs. Supabase Pro: $25-300/Monat

---

## Nächste Schritte

1. **Entscheidung**: PostgreSQL Hosting (Railway vs Neon vs Self-hosted)
2. **Setup**: Database Package im Monorepo erstellen
3. **Schema**: Drizzle Schema implementieren
4. **Start**: Phase 1 beginnen

Bereit zum Start?
