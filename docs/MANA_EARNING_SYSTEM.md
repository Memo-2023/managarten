# Mana Earning System

Konzept für fraud-resistente Mechanismen, durch die Nutzer Mana Credits verdienen können.

## Status: Planung

**Letzte Aktualisierung:** 2026-02-16

---

## Übersicht

Das Earning-System besteht aus drei Säulen:

| Säule | Beschreibung | Reward-Typ |
|-------|--------------|------------|
| **Karma/XP System** | Gamification ohne monetären Wert | XP, Badges, Levels |
| **Creator Rewards** | Social-Proof-basierte Content-Belohnung | Credits (delayed) |
| **Community Bounties** | Kuratierte Belohnungen für Contributions | Credits (manual) |

### Design-Prinzipien

1. **Fraud-Resistenz vor Großzügigkeit** - Lieber weniger Rewards als exploitable Systems
2. **Social Proof** - Rewards basieren auf Nutzen für ANDERE, nicht eigene Aktionen
3. **Delayed Gratification** - Zeit für Fraud-Detection vor Auszahlung
4. **Manual Gates** - Große Rewards immer mit menschlicher Review
5. **Non-monetary Gamification** - Engagement ohne Credit-Risiko

---

## 1. Karma/XP System

### Konzept

Ein nicht-monetäres Punktesystem für Engagement und Gamification. XP können NICHT für AI-Features eingetauscht werden - sie dienen nur der Motivation und Status-Anzeige.

### Warum kein Credit-Risiko?

```
XP hat keinen monetären Wert
→ Farming bringt keinen finanziellen Vorteil
→ Kein Anreiz für Bots/Multi-Accounts
→ Wir können großzügig sein ohne Risiko
```

### XP-Quellen

#### Tägliche Aktivität

| Aktion | XP | Limit |
|--------|-----|-------|
| Täglicher Login | 10 | 1x/Tag |
| Erste Aktion des Tages | 5 | 1x/Tag |
| 5 Minuten aktive Nutzung | 5 | 6x/Tag (30 Min max) |

#### App-Nutzung

| Aktion | XP | Limit |
|--------|-----|-------|
| Task erstellen | 1 | 50/Tag |
| Task erledigen | 2 | 50/Tag |
| Event erstellen | 2 | 20/Tag |
| Kontakt hinzufügen | 1 | 30/Tag |
| Deck erstellen | 5 | 10/Tag |
| Karte erstellen | 1 | 100/Tag |
| Präsentation erstellen | 5 | 5/Tag |

#### Streaks

| Streak | XP Bonus |
|--------|----------|
| 7 Tage | 50 |
| 30 Tage | 200 |
| 100 Tage | 500 |
| 365 Tage | 2000 |

#### Cross-App Nutzung

| Aktion | XP |
|--------|-----|
| 3 Apps an einem Tag genutzt | 20 |
| 5 Apps an einem Tag genutzt | 50 |
| Alle Apps in einer Woche genutzt | 100 |

### Level-System

```
Level 1:    0 XP        → Newcomer
Level 5:    500 XP      → Regular
Level 10:   2,000 XP    → Enthusiast
Level 20:   10,000 XP   → Power User
Level 30:   30,000 XP   → Expert
Level 50:   100,000 XP  → Legend
Level 100:  500,000 XP  → Mana Master
```

### Level-Vorteile (keine Credits!)

| Level | Vorteil |
|-------|---------|
| 5 | Profilrahmen (Bronze) |
| 10 | Custom Themes freischalten |
| 20 | Profilrahmen (Silber) |
| 30 | Early Access zu Beta Features |
| 50 | Profilrahmen (Gold) |
| 75 | Leaderboard Badge |
| 100 | Profilrahmen (Legendary) + "OG" Status |

### Leaderboards

- **Täglich**: Top 100 XP heute
- **Wöchentlich**: Top 100 XP diese Woche
- **Monatlich**: Top 100 XP diesen Monat
- **All-Time**: Top 1000 Gesamt-XP

### Datenbank-Schema

```sql
-- XP Balances
CREATE TABLE karma.balances (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    total_xp BIGINT NOT NULL DEFAULT 0,
    current_level INTEGER NOT NULL DEFAULT 1,
    daily_xp INTEGER NOT NULL DEFAULT 0,
    weekly_xp INTEGER NOT NULL DEFAULT 0,
    monthly_xp INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- XP Transactions (für Audit, optional)
CREATE TABLE karma.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    amount INTEGER NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'daily_login', 'task_complete', 'streak_bonus', etc.
    source_id VARCHAR(100), -- optional: task_id, deck_id, etc.
    app_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_karma_balances_total ON karma.balances(total_xp DESC);
CREATE INDEX idx_karma_balances_daily ON karma.balances(daily_xp DESC);
CREATE INDEX idx_karma_transactions_user ON karma.transactions(user_id, created_at DESC);

-- Daily reset job (cron)
-- Reset daily_xp at midnight
-- Reset weekly_xp on Monday
-- Reset monthly_xp on 1st
```

### API Endpoints

```
GET  /api/v1/karma/balance          → { totalXp, level, streak, rank }
GET  /api/v1/karma/leaderboard      → { daily: [...], weekly: [...], allTime: [...] }
POST /api/v1/karma/claim-streak     → { bonus: 50, newStreak: 7 }
GET  /api/v1/karma/history          → [{ amount, source, createdAt }, ...]
```

---

## 2. Creator Rewards (Social Proof)

### Konzept

Credits für Content, der von ANDEREN Nutzern tatsächlich verwendet wird. Nicht für das Erstellen, sondern für den Nutzen.

### Fraud-Prevention Mechanismen

1. **Social Proof Required**: Nur Nutzung durch ANDERE zählt
2. **Verified Users Only**: Nur Interaktionen von verifizierten Usern zählen
3. **Delayed Payout**: 14 Tage Wartezeit für Fraud-Check
4. **Monthly Cap**: Max 100 Credits/Monat durch Creator Rewards
5. **Quality Gate**: Mindeststandards für Content

### Was ist ein "Verified User"?

```
Ein User gilt als "verified" wenn MINDESTENS EINS zutrifft:
- Hat mindestens 1x Credits gekauft
- Account älter als 60 Tage UND mindestens 30 aktive Tage
- Verifizierte E-Mail von bekanntem Provider (nicht temp-mail)
- Manuell vom Team verifiziert
```

### Reward-Struktur

#### Cardecky

| Metrik | Threshold | Credits | Max/Monat |
|--------|-----------|---------|-----------|
| Deck kopiert | 10 verified User | 5 | 50 |
| Deck kopiert | 50 verified User | 15 | 30 |
| Deck kopiert | 100 verified User | 30 | 30 |
| Featured Deck | Team-Auswahl | 50 | 50 |

#### Quotes

| Metrik | Threshold | Credits | Max/Monat |
|--------|-----------|---------|-----------|
| Zitat eingereicht & akzeptiert | Nach Review | 3 | 30 |
| Zitat wird 100x angezeigt | Unique User | 5 | 25 |
| Zitat-Sammlung geteilt & genutzt | 10 verified Nutzer | 10 | 20 |

#### Presi

| Metrik | Threshold | Credits | Max/Monat |
|--------|-----------|---------|-----------|
| Template erstellt & approved | Nach Review | 10 | 30 |
| Template wird genutzt | 20 verified User | 10 | 40 |

### Payout-Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Creator Reward Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Tag 0: User A erstellt Deck                                │
│         → Status: "Public"                                   │
│                                                              │
│  Tag 1-14: Andere User kopieren das Deck                    │
│         → Copies werden gezählt (nur verified users)        │
│         → Anti-Fraud Checks laufen                          │
│                                                              │
│  Tag 14: Evaluation                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Fraud-Check:                                        │    │
│  │  - Kopien von verschiedenen IPs? ✓                  │    │
│  │  - Kopien über Zeit verteilt? ✓                     │    │
│  │  - Keine Muster (Ring-Verdacht)? ✓                  │    │
│  │  - Content-Qualität OK? ✓                           │    │
│  └─────────────────────────────────────────────────────┘    │
│         │                                                    │
│         ├─── Pass → Credits gutschreiben                    │
│         │           → Transaction: type='creator_reward'    │
│         │                                                    │
│         └─── Fail → Manuelle Review-Queue                   │
│                     → Ggf. Account-Flag                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Datenbank-Schema

```sql
-- Pending Creator Rewards
CREATE TABLE credits.creator_rewards_pending (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content_type VARCHAR(50) NOT NULL, -- 'deck', 'quote', 'template'
    content_id UUID NOT NULL,
    reward_type VARCHAR(50) NOT NULL, -- 'copies_10', 'copies_50', 'featured'
    credits_amount INTEGER NOT NULL,
    verified_interactions INTEGER NOT NULL DEFAULT 0,
    interaction_user_ids UUID[] NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'paid'
    fraud_score INTEGER DEFAULT 0,
    fraud_signals JSONB DEFAULT '[]',
    eligible_at TIMESTAMPTZ NOT NULL, -- created_at + 14 days
    reviewed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verified Users Cache (für Performance)
CREATE MATERIALIZED VIEW credits.verified_users AS
SELECT
    u.id as user_id,
    CASE
        WHEN EXISTS (SELECT 1 FROM credits.purchases p WHERE p.user_id = u.id AND p.status = 'completed') THEN true
        WHEN u.created_at < NOW() - INTERVAL '60 days'
             AND (SELECT COUNT(DISTINCT DATE(created_at)) FROM karma.transactions WHERE user_id = u.id) >= 30 THEN true
        ELSE false
    END as is_verified
FROM auth.users u;

-- Refresh daily
CREATE INDEX idx_verified_users ON credits.verified_users(user_id) WHERE is_verified = true;

-- Content Interactions Tracking
CREATE TABLE credits.content_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    creator_user_id UUID NOT NULL,
    interacting_user_id UUID NOT NULL,
    interaction_type VARCHAR(50) NOT NULL, -- 'copy', 'like', 'use'
    is_verified_user BOOLEAN NOT NULL DEFAULT false,
    ip_hash VARCHAR(64), -- hashed for privacy
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(content_type, content_id, interacting_user_id, interaction_type)
);

CREATE INDEX idx_content_interactions_creator ON credits.content_interactions(creator_user_id, created_at DESC);
CREATE INDEX idx_content_interactions_content ON credits.content_interactions(content_type, content_id);
```

### Fraud-Detection Signals

```typescript
interface FraudSignals {
  // Timing-basiert
  allInteractionsWithin24h: boolean;      // Verdächtig wenn true
  interactionsEvenlySpaced: boolean;      // Bot-Pattern

  // User-basiert
  sameIpCluster: boolean;                 // Viele User, gleiche IP
  newAccountCluster: boolean;             // Viele neue Accounts
  lowActivityAccounts: boolean;           // Accounts ohne sonstige Aktivität

  // Pattern-basiert
  reciprocalInteractions: boolean;        // A kopiert B, B kopiert A
  ringPattern: boolean;                   // A→B→C→D→A

  // Content-basiert
  duplicateContent: boolean;              // Kopie von anderem Deck
  lowQualityContent: boolean;             // Zu kurz, kein Inhalt

  // Historical
  previousFraudFlags: number;             // Frühere Flags
}

// Score calculation
function calculateFraudScore(signals: FraudSignals): number {
  let score = 0;
  if (signals.allInteractionsWithin24h) score += 30;
  if (signals.interactionsEvenlySpaced) score += 20;
  if (signals.sameIpCluster) score += 40;
  if (signals.newAccountCluster) score += 25;
  if (signals.reciprocalInteractions) score += 35;
  if (signals.ringPattern) score += 50;
  if (signals.duplicateContent) score += 40;
  if (signals.previousFraudFlags > 0) score += signals.previousFraudFlags * 15;
  return Math.min(score, 100);
}

// Thresholds
const FRAUD_THRESHOLDS = {
  AUTO_APPROVE: 10,    // Score < 10: Auto-approve
  MANUAL_REVIEW: 30,   // Score 10-30: Queue for review
  AUTO_REJECT: 50,     // Score > 50: Auto-reject
};
```

---

## 3. Community Bounties

### Konzept

Manuell kuratierte Belohnungen für wertvolle Community-Beiträge. Jede Auszahlung erfordert Team-Review.

### Bug Bounty Program

#### Severity Levels

| Severity | Beschreibung | Credits | Beispiele |
|----------|--------------|---------|-----------|
| **Critical** | Sicherheit, Datenverlust | 500-1000 | Auth Bypass, SQL Injection, Data Leak |
| **High** | Major Feature kaputt | 100-250 | App Crash, Datenverlust (lokal), Payment Bug |
| **Medium** | Feature funktioniert nicht richtig | 25-75 | Falsches Verhalten, Sync-Probleme |
| **Low** | Kleinere Bugs | 10-25 | UI Glitches, Typos, Edge Cases |
| **Cosmetic** | Nur visuell | 5 | Alignment, Farben, Spacing |

#### Bug Report Prozess

```
┌─────────────────────────────────────────────────────────────┐
│                     Bug Report Flow                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User öffnet Bug Report                                  │
│     - App auswählen                                         │
│     - Titel (kurz)                                          │
│     - Description (Steps to Reproduce)                      │
│     - Expected vs Actual Behavior                           │
│     - Screenshots/Video (optional, +10% Bonus)              │
│     - Device/Browser Info (auto-filled)                     │
│                                                              │
│  2. Automatische Checks                                      │
│     - Duplikat-Check (Similarity zu existierenden Bugs)     │
│     - Spam-Check (zu kurz, bekannte Patterns)               │
│     - Rate Limit (max 5 Reports/Tag)                        │
│                                                              │
│  3. Triage Queue                                             │
│     Team reviewed innerhalb 48h:                            │
│     - Ist es ein echter Bug? → Severity zuweisen            │
│     - Duplikat? → Link zu Original, kleiner Trostpreis (5)  │
│     - Kein Bug? → Ablehnen mit Begründung                   │
│                                                              │
│  4. Bug wird gefixt                                          │
│     - Credits werden gutgeschrieben                         │
│     - Optional: Erwähnung in Release Notes                  │
│                                                              │
│  5. Hall of Fame                                             │
│     - Monatliche Top Bug Hunters                            │
│     - Lifetime Leaderboard                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Bug Report Schema

```sql
CREATE TABLE community.bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Report Details
    app_id VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    steps_to_reproduce TEXT,
    expected_behavior TEXT,
    actual_behavior TEXT,

    -- Attachments
    screenshot_urls TEXT[],
    video_url TEXT,

    -- Device Info
    device_info JSONB, -- { platform, os, browser, appVersion }

    -- Triage
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending', 'triaging', 'confirmed', 'duplicate', 'not_a_bug', 'fixed', 'wont_fix'
    severity VARCHAR(20), -- 'critical', 'high', 'medium', 'low', 'cosmetic'
    duplicate_of UUID REFERENCES community.bug_reports(id),

    -- Reward
    credits_awarded INTEGER,
    transaction_id UUID REFERENCES credits.transactions(id),

    -- Internal
    internal_notes TEXT,
    assigned_to VARCHAR(100),
    github_issue_url TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    triaged_at TIMESTAMPTZ,
    fixed_at TIMESTAMPTZ,

    -- Anti-spam
    ip_hash VARCHAR(64),
    similarity_score FLOAT -- zu existierenden Reports
);

CREATE INDEX idx_bug_reports_user ON community.bug_reports(user_id);
CREATE INDEX idx_bug_reports_status ON community.bug_reports(status);
CREATE INDEX idx_bug_reports_app ON community.bug_reports(app_id, status);
```

### Feature Suggestions

| Phase | Credits | Bedingung |
|-------|---------|-----------|
| Eingereicht | 0 | - |
| Community Vote: 25+ Upvotes | 5 | Verified User Votes only |
| In Roadmap aufgenommen | 25 | Team-Entscheidung |
| Feature released | 75 | Implementation abgeschlossen |

### Community Help (Future)

Für spätere Phasen, wenn Community-Plattform existiert:

| Aktion | Credits | Review |
|--------|---------|--------|
| Antwort als "Lösung" markiert | 5 | Auto (durch Fragesteller) |
| Guide/Tutorial geschrieben | 25-75 | Manual Review |
| Video-Tutorial | 50-150 | Manual Review |
| Übersetzung beigetragen | 10-50 | Manual Review |

### Bounty Administration

```sql
-- Bounty Pool Tracking
CREATE TABLE community.bounty_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month DATE NOT NULL, -- First of month
    budget_credits INTEGER NOT NULL,
    spent_credits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly budget: e.g., 10,000 Credits
-- Prevents runaway spending
```

---

## Implementation Roadmap

### Phase 1: Karma/XP System

**Priority: High | Effort: Medium | Risk: Low**

#### TODO

- [ ] **Database Setup**
  - [ ] Create `karma` schema
  - [ ] Create `balances` table
  - [ ] Create `transactions` table
  - [ ] Setup daily/weekly/monthly reset cron jobs

- [ ] **Backend (mana-auth)**
  - [ ] Create `KarmaModule`
  - [ ] Create `KarmaService` with methods:
    - [ ] `awardXp(userId, amount, source, sourceId?, appId?)`
    - [ ] `getBalance(userId)`
    - [ ] `getLeaderboard(type: 'daily' | 'weekly' | 'monthly' | 'allTime')`
    - [ ] `calculateLevel(totalXp)`
    - [ ] `checkAndAwardStreakBonus(userId)`
  - [ ] Create `KarmaController` with endpoints
  - [ ] Create Event Listener für App-Events (Task complete, etc.)

- [ ] **Integration in Apps**
  - [ ] Event-Emitter in jeder App für XP-relevante Aktionen
  - [ ] Zentrales Event-Bus System (Redis Pub/Sub oder direkte HTTP calls)

- [ ] **Frontend (alle Web Apps)**
  - [ ] XP-Anzeige in Header/Profile
  - [ ] Level-Badge Component
  - [ ] Streak-Anzeige
  - [ ] Leaderboard-Page
  - [ ] Level-Up Animation/Notification

- [ ] **Testing**
  - [ ] Unit Tests für XP-Calculation
  - [ ] Unit Tests für Level-Calculation
  - [ ] Integration Tests für Streak-Logic
  - [ ] Load Tests für Leaderboard-Queries

### Phase 2: Creator Rewards

**Priority: Medium | Effort: High | Risk: Medium**

#### TODO

- [ ] **Database Setup**
  - [ ] Create `creator_rewards_pending` table
  - [ ] Create `content_interactions` table
  - [ ] Create `verified_users` materialized view
  - [ ] Setup daily refresh for materialized view

- [ ] **Fraud Detection Service**
  - [ ] Create `FraudDetectionService`
  - [ ] Implement fraud signal detection
  - [ ] Implement fraud score calculation
  - [ ] Setup scheduled job für 14-day evaluation

- [ ] **Backend (mana-auth)**
  - [ ] Create `CreatorRewardsModule`
  - [ ] Create `CreatorRewardsService`:
    - [ ] `trackInteraction(contentType, contentId, creatorId, interactingUserId)`
    - [ ] `evaluatePendingRewards()` - Scheduled job
    - [ ] `processApprovedRewards()`
    - [ ] `getCreatorStats(userId)`
  - [ ] Create Admin endpoints für Manual Review Queue

- [ ] **Integration in Content Apps**
  - [ ] Cardecky: Track deck copies
  - [ ] Quotes: Track quote submissions/views
  - [ ] Presi: Track template usage

- [ ] **Admin Dashboard**
  - [ ] Review Queue UI
  - [ ] Fraud Signal Visualization
  - [ ] Approve/Reject Workflow
  - [ ] Creator Stats Overview

- [ ] **Testing**
  - [ ] Fraud Detection Unit Tests
  - [ ] Integration Tests für Reward Flow
  - [ ] Manual QA für Edge Cases

### Phase 3: Community Bounties

**Priority: Medium | Effort: Medium | Risk: Low**

#### TODO

- [ ] **Database Setup**
  - [ ] Create `community` schema
  - [ ] Create `bug_reports` table
  - [ ] Create `feature_suggestions` table
  - [ ] Create `bounty_pool` table

- [ ] **Bug Report System**
  - [ ] Create `BugReportModule`
  - [ ] Create `BugReportService`:
    - [ ] `submitReport(userId, report)`
    - [ ] `checkDuplicate(report)` - Similarity check
    - [ ] `triageReport(reportId, severity)`
    - [ ] `awardBounty(reportId)`
  - [ ] Implement duplicate detection (embedding similarity?)
  - [ ] Create Triage Dashboard

- [ ] **Feature Suggestion System**
  - [ ] Create `FeatureSuggestionService`
  - [ ] Voting System (verified users only)
  - [ ] Roadmap Integration

- [ ] **Frontend**
  - [ ] Bug Report Form Component
  - [ ] Bug Report Status Tracker
  - [ ] Feature Suggestion Board
  - [ ] Bug Hunter Hall of Fame

- [ ] **Testing**
  - [ ] Duplicate Detection Tests
  - [ ] Bounty Payout Tests
  - [ ] Rate Limiting Tests

### Phase 4: Polish & Analytics

**Priority: Low | Effort: Low | Risk: Low**

#### TODO

- [ ] **Analytics Dashboard**
  - [ ] XP Distribution Charts
  - [ ] Creator Reward Stats
  - [ ] Fraud Detection Metrics
  - [ ] Bounty Pool Usage

- [ ] **Notifications**
  - [ ] Level Up Notifications
  - [ ] Reward Payout Notifications
  - [ ] Streak Warning (about to lose)
  - [ ] Bug Report Status Updates

- [ ] **Gamification Polish**
  - [ ] Profile Badges/Frames
  - [ ] Public Profile with Stats
  - [ ] Share Achievements
  - [ ] Seasonal Themes

---

## API Endpoints Summary

### Karma/XP

```
GET  /api/v1/karma/balance              → KarmaBalance
GET  /api/v1/karma/leaderboard          → LeaderboardResponse
GET  /api/v1/karma/history              → KarmaTransaction[]
POST /api/v1/karma/claim-streak         → StreakClaimResponse
```

### Creator Rewards

```
GET  /api/v1/creator/stats              → CreatorStats
GET  /api/v1/creator/pending-rewards    → PendingReward[]
GET  /api/v1/creator/history            → CreatorReward[]

# Admin
GET  /api/v1/admin/creator-rewards/queue     → PendingReward[]
POST /api/v1/admin/creator-rewards/:id/approve
POST /api/v1/admin/creator-rewards/:id/reject
```

### Bug Bounty

```
POST /api/v1/bugs/report                → BugReport
GET  /api/v1/bugs/my-reports            → BugReport[]
GET  /api/v1/bugs/hall-of-fame          → BugHunter[]

# Admin
GET  /api/v1/admin/bugs/triage-queue    → BugReport[]
POST /api/v1/admin/bugs/:id/triage      → { severity, credits }
POST /api/v1/admin/bugs/:id/close       → { status, reason }
```

### Feature Suggestions

```
POST /api/v1/features/suggest           → FeatureSuggestion
GET  /api/v1/features/list              → FeatureSuggestion[]
POST /api/v1/features/:id/vote          → { success, voteCount }
GET  /api/v1/features/my-suggestions    → FeatureSuggestion[]
```

---

## Monitoring & Alerts

### Metrics to Track

```typescript
// Karma System
karma_xp_awarded_total          // Counter: Total XP awarded
karma_level_ups_total           // Counter: Level ups
karma_active_streaks            // Gauge: Users with active streaks

// Creator Rewards
creator_rewards_pending         // Gauge: Pending rewards count
creator_rewards_approved        // Counter: Approved rewards
creator_rewards_rejected        // Counter: Rejected (fraud)
creator_fraud_score_avg         // Gauge: Average fraud score

// Bug Bounty
bugs_submitted_total            // Counter: Total reports
bugs_confirmed_total            // Counter: Confirmed bugs
bugs_bounty_paid_total          // Counter: Credits paid
bugs_triage_queue_size          // Gauge: Pending triage
```

### Alerts

```yaml
# Fraud Alert: Too many high-value rewards pending
- alert: CreatorRewardsFraudSpike
  expr: increase(creator_rewards_rejected[1h]) > 10
  labels:
    severity: warning
  annotations:
    summary: "High fraud rejection rate"

# Bug Bounty: Queue backlog
- alert: BugTriageBacklog
  expr: bugs_triage_queue_size > 50
  labels:
    severity: warning
  annotations:
    summary: "Bug triage queue growing"
```

---

## Security Considerations

### Rate Limits

| Endpoint | Limit |
|----------|-------|
| XP Award (internal) | 100/user/day |
| Bug Report Submit | 5/user/day |
| Feature Suggest | 3/user/day |
| Feature Vote | 20/user/day |

### Anti-Gaming Measures

1. **XP**: Daily caps prevent grinding
2. **Creator Rewards**: 14-day delay + fraud detection
3. **Bug Bounty**: Manual review required
4. **All**: Verified user requirements where applicable

### Data Privacy

- IP addresses stored as hashes only
- No tracking of specific content viewed
- Fraud signals anonymized in logs
- GDPR: All data exportable/deletable

---

## Open Questions

1. **XP Decay?** Sollte XP über Zeit verfallen wenn User inaktiv?
2. **Negative XP?** Sollte Spam/Abuse XP kosten?
3. **XP → Credits Conversion?** Zu einem späteren Zeitpunkt möglich?
4. **Creator Tiers?** Sollten Top-Creator bessere Rates bekommen?
5. **Bug Bounty Scope?** Nur eigene Apps oder auch Dependencies?

---

## Related Documents

- [Credit System (bestehend)](../services/mana-auth/src/credits/)
- [Credit Operations Registry](../packages/credit-operations/)
