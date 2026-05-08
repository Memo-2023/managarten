# SEPA-Lastschrift Aktivierung - Checkliste

> **Status:** Code deployed, Stripe Dashboard Konfiguration ausstehend
> **Datum:** 2026-02-16
> **Commit:** `b5d7524c` - feat(stripe): add SEPA Direct Debit payment option

---

## Übersicht

SEPA Direct Debit wurde im Code aktiviert. Diese Checkliste dokumentiert die verbleibenden manuellen Schritte und Tests.

**Vorteile:**
- Gebühren: 0.8% statt 1.5% + €0.25 (Ersparnis ~€0.32 pro €10)
- Beliebt bei DACH-Kunden
- Keine Kreditkarte erforderlich

**Besonderheit:**
- SEPA-Zahlungen sind nicht sofort bestätigt
- Bankverarbeitung dauert 3-14 Werktage
- Credits werden erst nach `payment_intent.succeeded` gutgeschrieben

---

## TODO: Stripe Dashboard Konfiguration

### [ ] 1. SEPA-Lastschrift aktivieren

**URL:** https://dashboard.stripe.com/settings/payment_methods

1. Einloggen in Stripe Dashboard
2. Settings → Payment methods
3. "SEPA Direct Debit" finden
4. "Turn on" klicken
5. SEPA-Bedingungen lesen und akzeptieren
6. Speichern

**Erwartetes Ergebnis:** SEPA Direct Debit erscheint als "Enabled"

---

### [ ] 2. Webhook-Event hinzufügen

**URL:** https://dashboard.stripe.com/webhooks

1. Webhook-Endpoint auswählen (URL endet mit `/webhooks/stripe`)
2. "Update details" klicken
3. Tab "Events" öffnen
4. Event hinzufügen: `payment_intent.processing`
5. "Update endpoint" klicken

**Bereits konfigurierte Events (sollten vorhanden sein):**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.created`
- `invoice.updated`
- `invoice.paid`
- `invoice.payment_failed`

**Neu hinzuzufügen:**
- `payment_intent.processing`

---

### [ ] 3. Server Deployment

```bash
ssh mana-server
cd ~/projects/managarten
git pull
./scripts/mac-mini/deploy.sh
```

**Verifizierung:**
```bash
# Logs prüfen
docker logs mana-auth --tail 50

# Health Check
curl https://auth.mana.how/health
```

---

## TODO: Tests

### [ ] 4. Test: Credit-Kauf mit SEPA (Testmodus)

**Voraussetzung:** Stripe ist im Testmodus oder Test-API-Keys verwenden

1. Öffne: https://mana.how/credits (oder lokale Dev-Umgebung)
2. Einloggen
3. Credit-Paket auswählen
4. "Kaufen" klicken
5. Im Checkout: **SEPA-Lastschrift** auswählen
6. Test-IBAN eingeben: `DE89370400440532013000`
7. Name eingeben
8. "Bezahlen" klicken

**Erwartetes Ergebnis:**
- Checkout erfolgreich abgeschlossen
- Weiterleitung zur Success-Seite
- Purchase-Status: `pending` (nicht `completed`!)
- Im Stripe Dashboard: PaymentIntent im Status `processing`

**Test-IBANs (Stripe Testmodus):**
| IBAN | Verhalten |
|------|-----------|
| `DE89370400440532013000` | Erfolgreiche Zahlung |
| `DE62370400440532013001` | Zahlung fehlgeschlagen |

---

### [ ] 5. Test: Subscription mit SEPA

1. Öffne: https://mana.how/subscription
2. Einloggen
3. Plan auswählen (Plus, Pro, oder Ultra)
4. "Abonnieren" klicken
5. Im Checkout: **SEPA-Lastschrift** auswählen
6. Test-IBAN eingeben
7. "Abonnieren" klicken

**Erwartetes Ergebnis:**
- Subscription erstellt
- Status: `active` (Stripe erlaubt sofortigen Zugang bei SEPA-Subscriptions)
- Erste Rechnung im Status `open` oder `paid`

---

### [ ] 6. Test: Webhook-Verarbeitung

**Im Stripe Dashboard (Developers → Webhooks → Event-Log):**

1. Nach dem Testkauf: Event `checkout.session.completed` prüfen
2. Event `payment_intent.processing` sollte erscheinen
3. Status: "Succeeded" (200 Response)

**In den Server-Logs:**
```bash
ssh mana-server
docker logs mana-auth --tail 100 | grep -i "sepa\|processing\|webhook"
```

**Erwartete Log-Einträge:**
```
Webhook received { type: 'checkout.session.completed', ... }
Webhook received { type: 'payment_intent.processing', ... }
Payment processing (SEPA in progress) { paymentIntentId: 'pi_...' }
```

---

### [ ] 7. Test: SEPA-Zahlung simulieren (Stripe CLI)

**Optional - für detailliertere Tests:**

```bash
# Stripe CLI installieren (falls nicht vorhanden)
brew install stripe/stripe-cli/stripe

# Einloggen
stripe login

# Webhook lokal testen
stripe listen --forward-to localhost:3001/webhooks/stripe

# In neuem Terminal: SEPA-Zahlung simulieren
stripe trigger payment_intent.processing
stripe trigger payment_intent.succeeded
```

---

### [ ] 8. Test: Payment Intent Completion (nach Bankverarbeitung)

**Im Stripe Dashboard:**

1. Developers → Events
2. PaymentIntent finden (vom Testkauf)
3. "Trigger webhook" → `payment_intent.succeeded`

**Oder via Stripe CLI:**
```bash
stripe payment_intents confirm pi_XXXXX --payment-method pm_sepa_debit
```

**Erwartetes Ergebnis:**
- Credits werden gutgeschrieben
- Purchase-Status wechselt zu `completed`
- Transaction-Eintrag erstellt

---

## Bekannte Einschränkungen

### SEPA-Timing
- Zahlungen sind nicht sofort bestätigt
- Kunden sehen Credits erst nach 3-14 Tagen
- UI sollte darauf hinweisen (optional: TODO für bessere UX)

### Rückbuchungen (R-Transactions)
- Kunden können SEPA-Lastschriften 8 Wochen widersprechen
- Bei Rückbuchung: `charge.dispute.created` Event
- Aktuell nicht behandelt (Credits werden nicht abgezogen)

### Währung
- SEPA funktioniert nur mit EUR
- Aktuell kein Problem (alle Preise in EUR)

---

## Dateien (Referenz)

| Datei | Änderung |
|-------|----------|
| `services/mana-auth/src/stripe/stripe.service.ts` | `payment_method_types: ['card', 'sepa_debit']` |
| `services/mana-auth/src/subscriptions/subscriptions.service.ts` | `payment_method_types: ['card', 'sepa_debit']` |
| `services/mana-auth/src/stripe/stripe-webhook.controller.ts` | `payment_intent.processing` Handler |
| `apps/mana/apps/landing/src/content/blueprints/003-*.md` | Dokumentation |

---

## Rollback (falls nötig)

Falls Probleme auftreten:

1. **SEPA im Dashboard deaktivieren:**
   - Stripe Dashboard → Settings → Payment methods
   - SEPA Direct Debit → "Turn off"

2. **Code-Rollback (nur falls kritisch):**
   ```bash
   git revert b5d7524c
   git push origin main
   # Dann neu deployen
   ```

---

## Abschluss

Nach Abschluss aller Tests:

- [ ] Diese Datei als erledigt markieren (Checkboxen abhaken)
- [ ] Im Team kommunizieren
- [ ] Monitoring für SEPA-Fehler einrichten (optional)
- [ ] Kundenkommunikation: "Jetzt auch per Lastschrift zahlen" (optional)

---

## Kontakt

Bei Fragen zur Implementation: Till Schneider
Blueprint-Dokumentation: `/apps/mana/apps/landing/src/content/blueprints/003-payment-systems-stripe-vs-direct-debit.md`
