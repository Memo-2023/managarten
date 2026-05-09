---
title: 'Gift Codes, Stripe Integration & Quotes Deployment'
description: 'Neues Gift Code System mit Credit-Gutscheinen, Stripe Integration für Subscriptions und Credit-Käufe, Quotes Production Deployment mit multilingualer Quote-Datenbank, sowie Calendar Drag-to-Create und Matrix WhatsApp-Style Navigation'
date: 2026-02-13
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'gift-codes',
    'stripe',
    'subscriptions',
    'credits',
    'quotes',
    'calendar',
    'matrix',
    'avatar',
    'onboarding',
    'docker',
    'pwa',
  ]
featured: true
commits: 55
readTime: 18
stats:
  filesChanged: 287
  linesAdded: 20500
  linesRemoved: 5752
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 55
workingHours:
  start: '2026-02-13T11:00'
  end: '2026-02-14T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Ein massiver Tag mit **55 Commits** und mehreren Major Features:

- **Gift Codes** - Credit-Gutscheine mit Code-Einlösung
- **Stripe Integration** - Subscriptions und Credit-Käufe
- **Quotes Deployment** - Production-Ready mit multilingualer Quote-DB
- **Calendar UX** - Drag-to-Create, Resize Handles, Live Preview
- **Matrix Mobile** - WhatsApp-Style Navigation für PWA
- **Avatar Upload** - S3/MinIO Integration mit Onboarding
- **ManaCore Dashboard** - Profile, Subscriptions, Credits UI

---

## Gift Codes & Credit System

Neues Geschenkkarten-System für Credit-Gutscheine.

### Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                     Gift Code System                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Admin erstellt Code          User löst Code ein                │
│  ┌─────────────────┐          ┌─────────────────┐               │
│  │ POST /gifts     │          │ POST /gifts/    │               │
│  │                 │          │   redeem        │               │
│  │ code: MANA-XXX  │          │ code: MANA-XXX  │               │
│  │ credits: 100    │          │                 │               │
│  │ maxUses: 10     │          └────────┬────────┘               │
│  └─────────────────┘                   │                        │
│                                        ▼                        │
│                              ┌─────────────────┐                │
│                              │ Credit Balance  │                │
│                              │ += 100 Credits  │                │
│                              └─────────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### API Endpoints

```typescript
// Gift Codes verwalten
POST /api/v1/gifts              // Code erstellen (Admin)
GET  /api/v1/gifts              // Alle Codes auflisten
GET  /api/v1/gifts/:code        // Code-Details abrufen
POST /api/v1/gifts/redeem       // Code einlösen (User)
DELETE /api/v1/gifts/:code      // Code löschen

// Request Body: Code einlösen
{
  "code": "MANA-WELCOME-2026"
}

// Response
{
  "success": true,
  "credits": 100,
  "message": "100 Credits wurden deinem Konto gutgeschrieben!"
}
```

### Database Schema

```typescript
// auth.schema.ts
export const giftCodes = authSchema.table('gift_codes', {
	id: text('id').primaryKey(),
	code: text('code').notNull().unique(),
	credits: integer('credits').notNull(),
	maxUses: integer('max_uses').default(1),
	currentUses: integer('current_uses').default(0),
	expiresAt: timestamp('expires_at'),
	createdBy: text('created_by').references(() => users.id),
	createdAt: timestamp('created_at').defaultNow(),
});

export const giftRedemptions = authSchema.table('gift_redemptions', {
	id: text('id').primaryKey(),
	codeId: text('code_id').references(() => giftCodes.id),
	userId: text('user_id').references(() => users.id),
	redeemedAt: timestamp('redeemed_at').defaultNow(),
});
```

### Matrix Bot Integration

Gift Codes können auch via Matrix eingelöst werden:

```
User: !redeem MANA-WELCOME-2026
Bot:  ✅ Code eingelöst! Du hast 100 Credits erhalten.
      Aktuelles Guthaben: 250 Credits
```

---

## Stripe Integration

Vollständige Stripe-Anbindung für Payments.

### Subscription Plans

```typescript
// Subscription Tiers
const SUBSCRIPTION_PLANS = {
	free: {
		name: 'Free',
		price: 0,
		credits: 50, // monatlich
		features: ['Basic Apps', '50 Credits/Monat'],
	},
	plus: {
		name: 'Plus',
		price: 4.99,
		stripePriceId: 'price_plus_monthly',
		credits: 500,
		features: ['Alle Apps', '500 Credits/Monat', 'Priority Support'],
	},
	pro: {
		name: 'Pro',
		price: 14.99,
		stripePriceId: 'price_pro_monthly',
		credits: 2000,
		features: ['Alle Apps', '2000 Credits/Monat', 'API Zugang', 'Priorität'],
	},
};
```

### Credit Purchases

```typescript
// Einmal-Käufe
POST /api/v1/credits/purchase
{
  "package": "credits_500"  // 500 Credits für 4.99€
}

// Verfügbare Pakete
const CREDIT_PACKAGES = {
  credits_100:  { credits: 100,  price: 0.99,  stripePriceId: '...' },
  credits_500:  { credits: 500,  price: 4.99,  stripePriceId: '...' },
  credits_1000: { credits: 1000, price: 8.99,  stripePriceId: '...' },
  credits_5000: { credits: 5000, price: 39.99, stripePriceId: '...' },
};
```

### Webhook Handler

```typescript
// stripe.controller.ts
@Post('webhook')
async handleWebhook(@Req() req: Request) {
  const event = this.stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'],
    this.webhookSecret,
  );

  switch (event.type) {
    case 'checkout.session.completed':
      await this.handleCheckoutComplete(event.data.object);
      break;
    case 'customer.subscription.updated':
      await this.handleSubscriptionUpdate(event.data.object);
      break;
    case 'invoice.paid':
      await this.handleInvoicePaid(event.data.object);
      break;
  }
}
```

---

## Quotes Production Deployment

Quotes ist jetzt live auf quotes.mana.how!

### Docker Infrastructure

```yaml
# docker-compose.macmini.yml
quotes-backend:
  build:
    context: .
    dockerfile: apps/quotes/apps/backend/Dockerfile
  ports:
    - '3007:3007'
  environment:
    DATABASE_URL: ${QUOTES_DATABASE_URL}
    MANA_CORE_AUTH_URL: http://mana-core-auth:3001
  healthcheck:
    test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:3007/health']

quotes-web:
  build:
    context: .
    dockerfile: apps/quotes/apps/web/Dockerfile
  ports:
    - '5018:5018'
  depends_on:
    - quotes-backend
```

### @quotes/content Package

Neues Package für shared Quotes:

```typescript
// packages/quotes-content/src/quotes.ts
export interface Quote {
	id: string;
	text: string;
	author: string;
	source?: string;
	year?: number;
	language: 'de' | 'en';
	category: QuoteCategory;
	tags: string[];
}

export const quotes: Quote[] = [
	{
		id: 'goethe-001',
		text: 'Es ist nicht genug zu wissen, man muss auch anwenden...',
		author: 'Johann Wolfgang von Goethe',
		source: 'Wilhelm Meisters Wanderjahre',
		year: 1829,
		language: 'de',
		category: 'wisdom',
		tags: ['wissen', 'handeln', 'motivation'],
	},
	// ... 500+ Zitate
];
```

### Multilingual Support

```typescript
// Backend: Sprache aus Header
@Get('quote/daily')
getDailyQuote(@Headers('accept-language') lang: string) {
  const language = lang?.startsWith('de') ? 'de' : 'en';
  return this.quoteService.getDailyQuote(language);
}

// Frontend: i18n Integration
const { t, locale } = useTranslation();
const quote = await fetchDailyQuote($locale);
```

### Quote Metadata

Alle Zitate mit vollständigen Metadaten:

| Feld       | Beschreibung                        |
| ---------- | ----------------------------------- |
| `author`   | Vollständiger Name                  |
| `source`   | Buch/Werk/Rede                      |
| `year`     | Entstehungsjahr                     |
| `category` | wisdom, motivation, love, life, ... |
| `tags`     | Suchbare Schlagwörter               |

---

## Calendar UX Improvements

Mehrere UX-Verbesserungen für den Kalender.

### Drag-to-Create

Events können jetzt durch Drag & Drop erstellt werden:

```svelte
<script lang="ts">
	let dragStart = $state<{ hour: number; day: Date } | null>(null);
	let dragEnd = $state<{ hour: number; day: Date } | null>(null);

	function handleMouseDown(hour: number, day: Date) {
		dragStart = { hour, day };
	}

	function handleMouseMove(hour: number, day: Date) {
		if (dragStart) {
			dragEnd = { hour, day };
		}
	}

	function handleMouseUp() {
		if (dragStart && dragEnd) {
			createEvent({
				start: new Date(dragStart.day.setHours(dragStart.hour)),
				end: new Date(dragEnd.day.setHours(dragEnd.hour)),
			});
		}
		dragStart = null;
		dragEnd = null;
	}
</script>
```

### Live Time Preview

Beim Ziehen wird die neue Zeit live angezeigt:

```svelte
{#if dragStart && dragEnd}
	<div class="preview-overlay">
		{formatTime(dragStart.hour)} - {formatTime(dragEnd.hour)}
	</div>
{/if}
```

### Resize Handles

Größere Resize-Handles für bessere Touch-Bedienbarkeit:

```css
.event-resize-handle {
	height: 12px; /* Vorher: 6px */
	cursor: ns-resize;
	touch-action: none;
}

/* Mobile: Noch größer */
@media (max-width: 768px) {
	.event-resize-handle {
		height: 20px;
	}
}
```

### Mobile UX

- Tasks standardmäßig ausgeblendet
- Auto-Scroll zur aktuellen Stunde
- Mikrofon-Button in der Input Bar integriert
- Padding für Bottom-UI Sichtbarkeit

---

## Matrix WhatsApp-Style Navigation

Neue Mobile-Navigation für die Matrix PWA.

### Navigation Pattern

```
┌─────────────────────────────────────────┐
│  ← Rooms          Matrix        Settings│  ← Header
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ General                      >  │    │
│  ├─────────────────────────────────┤    │
│  │ Development                  >  │    │
│  ├─────────────────────────────────┤    │
│  │ @user:mana.how               >  │    │
│  └─────────────────────────────────┘    │
│                                         │
│                                         │  ← Room List
│                                         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │           + New Chat            │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘

        ↓ Tap on Room ↓

┌─────────────────────────────────────────┐
│  ←  General                    ⋮        │  ← Room Header
├─────────────────────────────────────────┤
│                                         │
│  Alice: Hey, wie geht's?                │
│                                         │
│                        Bob: Gut, danke! │
│                                         │
│  Alice: Hast du das Feature gesehen?    │
│                                         │
├─────────────────────────────────────────┤
│  [Message input...]              Send   │
└─────────────────────────────────────────┘
```

### iOS PWA Swipe-Back

```svelte
<script lang="ts">
	let touchStartX = 0;

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
	}

	function handleTouchEnd(e: TouchEvent) {
		const touchEndX = e.changedTouches[0].clientX;
		const diff = touchEndX - touchStartX;

		// Swipe from left edge
		if (touchStartX < 30 && diff > 100) {
			goBack();
		}
	}
</script>

<div ontouchstart={handleTouchStart} ontouchend={handleTouchEnd}>
	<!-- Room Content -->
</div>
```

### Mobile Web App Meta Tags

```html
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

---

## Avatar Upload & Onboarding

Neues Avatar-System mit S3/MinIO.

### Upload Flow

```typescript
// POST /api/v1/me/avatar
@Post('avatar')
@UseInterceptors(FileInterceptor('avatar'))
async uploadAvatar(
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() user: CurrentUserData,
) {
  // Resize und optimieren
  const optimized = await sharp(file.buffer)
    .resize(256, 256)
    .webp({ quality: 80 })
    .toBuffer();

  // Upload zu S3/MinIO
  const key = `avatars/${user.userId}.webp`;
  await this.storageService.upload(key, optimized, {
    contentType: 'image/webp',
    public: true,
  });

  // URL speichern
  await this.userService.updateAvatar(user.userId, key);

  return { avatarUrl: this.storageService.getPublicUrl(key) };
}
```

### Onboarding Wizard

Neuer Wizard für neue Nutzer:

```
┌─────────────────────────────────────────┐
│         Welcome to ManaCore!             │
├─────────────────────────────────────────┤
│                                         │
│         ┌───────────────┐               │
│         │     📷        │  ← Avatar     │
│         │  Upload Photo │               │
│         └───────────────┘               │
│                                         │
│  Display Name: [________________]       │
│                                         │
│  Language:     [Deutsch        ▼]       │
│                                         │
│  Theme:        ○ Light  ● Dark  ○ Auto  │
│                                         │
│         [ Continue → ]                  │
│                                         │
└─────────────────────────────────────────┘
```

---

## ManaCore Dashboard

Neues Dashboard auf mana.how.

### Profile Section

```svelte
<div class="profile-card">
	<Avatar src={user.avatarUrl} size="lg" />
	<h2>{user.name}</h2>
	<p>{user.email}</p>

	<div class="stats">
		<Stat label="Credits" value={credits} />
		<Stat label="Subscription" value={subscription.name} />
		<Stat label="Member since" value={formatDate(user.createdAt)} />
	</div>
</div>
```

### Subscription Management

```svelte
<SubscriptionCard
	current={subscription}
	plans={SUBSCRIPTION_PLANS}
	onUpgrade={handleUpgrade}
	onCancel={handleCancel}
/>
```

### Credits Frontend

```svelte
<CreditsDashboard>
	<CreditBalance balance={credits} />
	<CreditHistory {transactions} />
	<CreditPurchase packages={CREDIT_PACKAGES} />
</CreditsDashboard>
```

### Storage Usage Widget

```svelte
<StorageUsageWidget
	used={storageUsed}
	total={storageTotal}
	breakdown={[
		{ label: 'Photos', size: photosSize, color: 'blue' },
		{ label: 'Documents', size: docsSize, color: 'green' },
		{ label: 'Other', size: otherSize, color: 'gray' },
	]}
/>
```

### API Keys Management

```svelte
<ApiKeysManager
	keys={apiKeys}
	onCreate={createKey}
	onRevoke={revokeKey}
	services={['stt', 'tts', 'llm']}
/>
```

---

## Settings Stores

Neue Settings-Stores für Quotes und Todo.

### Pattern

```typescript
// stores/settings.store.ts
import { persisted } from 'svelte-persisted-store';

export interface AppSettings {
	theme: 'light' | 'dark' | 'auto';
	language: string;
	notifications: boolean;
	// App-spezifische Settings
}

export const settings = persisted<AppSettings>('app-settings', {
	theme: 'auto',
	language: 'de',
	notifications: true,
});
```

### Quotes Settings

```typescript
interface QuotesSettings extends AppSettings {
	dailyNotificationTime: string; // "09:00"
	favoriteCategories: string[];
	showAuthorInfo: boolean;
}
```

### Todo Settings

```typescript
interface TodoSettings extends AppSettings {
	defaultPriority: Priority;
	showCompletedTasks: boolean;
	sortOrder: 'priority' | 'dueDate' | 'created';
}
```

---

## Devlog Activity Grid

Neue Activity-Seite für Devlogs.

### Features

- GitHub-Style Contribution Grid
- Commit-Statistiken pro Tag
- Hover-Details mit Commit-Count
- Link zu Devlog-Einträgen

### Implementation

```svelte
<ActivityGrid
	data={devlogStats}
	colorScale={['#eee', '#9be9a8', '#40c463', '#30a14e', '#216e39']}
	cellSize={12}
	gap={3}
/>
```

---

## Weitere Änderungen

### Shared UI Refactoring

LoginPage und InputBar Komponenten verbessert:

```typescript
// Bessere Props-Struktur
interface LoginPageProps {
	locale: string;
	onLogin: (credentials: LoginCredentials) => Promise<void>;
	onRegister?: () => void;
	onForgotPassword?: () => void;
	showRememberMe?: boolean;
	allowSocialLogin?: boolean;
}
```

### Matrix Bot Enhancements

- Stats Bot: Detailliertere Statistiken
- Todo Bot: Cleaner Response Messages
- Offline Mode entfernt - Login erforderlich

### Docker Local Builds

Weitere Services auf lokale Builds umgestellt:

| Service             | Grund                |
| ------------------- | -------------------- |
| matrix-todo-bot     | Native Dependencies  |
| matrix-calendar-bot | Native Dependencies  |
| presi-backend       | Schnellere Iteration |
| mana-web            | Shared Packages      |

---

## Zusammenfassung

| Bereich               | Commits | Highlights                      |
| --------------------- | ------- | ------------------------------- |
| **Gift Codes**        | 4       | Code-System, Matrix Integration |
| **Stripe**            | 3       | Subscriptions, Credit Purchases |
| **Quotes**            | 10      | Docker, Quotes, i18n            |
| **Calendar**          | 6       | Drag-Create, Resize, Mobile UX  |
| **Matrix**            | 8       | WhatsApp-Nav, PWA, Swipe        |
| **ManaCore**          | 8       | Profile, Credits, Storage       |
| **Avatar/Onboarding** | 3       | S3 Upload, Wizard               |
| **Settings**          | 2       | Quotes, Todo Stores             |
| **Auth/Docker**       | 8       | Healthchecks, Builds            |
| **Devlog**            | 3       | Activity Grid                   |

---

## Nächste Schritte

1. **Stripe Webhooks** - Production Webhook Secret konfigurieren
2. **Gift Code UI** - Admin-Panel für Code-Erstellung
3. **Subscription Emails** - Bestätigungen und Erinnerungen
4. **Matrix E2EE** - Verschlüsselung für DMs aktivieren
5. **Quotes Push** - Daily Quote Notifications
