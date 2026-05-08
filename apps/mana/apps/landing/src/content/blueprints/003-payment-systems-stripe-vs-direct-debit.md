---
title: 'Stripe vs. Direkter Bankeinzug: Payment-Optionen für SaaS'
description: 'Analyse der Payment-Möglichkeiten für europäische SaaS-Produkte: Stripe-Integration, Schweizer LSV+, deutsches FinTS/HBCI und SEPA-Lastschrift im Vergleich'
date: 2026-02-16
author: 'Till Schneider'
category: 'business-model'
status: 'accepted'
tags:
  [
    'payments',
    'stripe',
    'sepa',
    'lastschrift',
    'lsv',
    'fints',
    'hbci',
    'schweiz',
    'deutschland',
    'monetarisierung',
    'saas',
    'subscriptions',
  ]
featured: true
readTime: 15
decisionDate: 2026-02-16
---

# Stripe vs. Direkter Bankeinzug: Payment-Optionen für SaaS

Als europäisches SaaS-Unternehmen stellt sich früher oder später die Frage: **Kann man Zahlungen auch ohne Payment-Provider wie Stripe direkt über die Hausbank abwickeln?** Dieser Artikel analysiert die technischen Möglichkeiten, Kosten und Vor-/Nachteile.

---

## Inhaltsverzeichnis

1. [Ausgangssituation](#ausgangssituation)
2. [Option 1: Stripe (Status Quo)](#option-1-stripe-status-quo)
3. [Option 2: Schweizer Bankeinzug (LSV+)](#option-2-schweizer-bankeinzug-lsv)
4. [Option 3: Deutscher Bankeinzug (FinTS/HBCI)](#option-3-deutscher-bankeinzug-fintshbci)
5. [Option 4: Stripe SEPA-Lastschrift (Kompromiss)](#option-4-stripe-sepa-lastschrift-kompromiss)
6. [Vergleichsmatrix](#vergleichsmatrix)
7. [Entscheidung & Empfehlung](#entscheidung--empfehlung)
8. [Quellen](#quellen)

---

## Ausgangssituation

Mana verwendet aktuell eine umfangreiche **Stripe-Integration** für Monetarisierung:

### Aktuelles Zwei-Säulen-Modell

```
┌─────────────────────────────────────────────────────────────────┐
│                    Mana Monetarisierung                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Säule 1: Subscriptions              Säule 2: Credits           │
│  ┌─────────────────────────┐        ┌─────────────────────────┐ │
│  │ Free    €0/Monat        │        │ 100 Credits   €0.99     │ │
│  │ Plus    €4.99/Monat     │        │ 500 Credits   €4.99     │ │
│  │ Pro     €11.99/Monat    │        │ 1000 Credits  €8.99     │ │
│  │ Ultra   €24.99/Monat    │        │ 5000 Credits  €39.99    │ │
│  └─────────────────────────┘        └─────────────────────────┘ │
│                                                                  │
│  + Jahresabos mit ~17% Rabatt       + Gift Codes für Gutscheine │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Stripe-Gebühren (aktuell)

| Zahlungsart | Gebühr | Beispiel €10 |
|-------------|--------|--------------|
| Kreditkarte (EU) | 1.5% + €0.25 | €0.40 |
| Kreditkarte (Non-EU) | 2.9% + €0.25 | €0.54 |
| SEPA-Lastschrift | 0.8% (max €5) | €0.08 |

**Frage:** Können wir diese Gebühren eliminieren, indem wir direkt mit der Hausbank arbeiten?

---

## Option 1: Stripe (Status Quo)

### Vorteile

| Aspekt | Bewertung |
|--------|-----------|
| **API-Qualität** | Erstklassige REST-API, SDKs für alle Sprachen |
| **Integration** | ~2 Tage für Grundintegration |
| **Dokumentation** | Branchenführend, mit Code-Beispielen |
| **Compliance** | PCI DSS Level 1, DSGVO-konform |
| **Features** | Subscriptions, Invoices, Customer Portal, Webhooks |
| **Support** | 24/7, mehrsprachig |

### Nachteile

| Aspekt | Bewertung |
|--------|-----------|
| **Gebühren** | 1.5-2.9% + €0.25 pro Transaktion |
| **Abhängigkeit** | Vendor Lock-in (Stripe-spezifische APIs) |
| **Kontosperre** | Risiko bei "High-Risk" Kategorien |
| **Auszahlung** | 2-7 Tage Verzögerung |

### Aktuelle Implementation

```typescript
// services/mana-core-auth/src/stripe/stripe.service.ts
@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2025-02-24.acacia',
    });
  }

  async createPaymentIntent(customerId: string, amountCents: number) {
    return this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
    });
  }
}
```

---

## Option 2: Schweizer Bankeinzug (LSV+)

### Was ist LSV+?

**LSV+ (Lastschriftverfahren)** ist das Schweizer Pendant zur SEPA-Lastschrift. Es ermöglicht Unternehmen, Beträge direkt von Kundenkonten einzuziehen.

```
┌─────────────────────────────────────────────────────────────────┐
│                      LSV+ Ablauf                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Kunde unterschreibt          2. Unternehmen erstellt        │
│     LSV-Mandat (Papier!)            XML-Datei (pain.008)        │
│                                                                  │
│  3. Upload via E-Banking         4. SIX Interbank Clearing      │
│     oder payCOMweb                  verarbeitet Lastschrift     │
│                                                                  │
│  5. Geld wird eingezogen         6. Kunde kann 30 Tage          │
│     (T+2 Werktage)                  widersprechen (LSV+)        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Raiffeisen Schweiz: Technische Möglichkeiten

| Aspekt | Bewertung |
|--------|-----------|
| **API-Zugang** | Keine moderne REST-API verfügbar |
| **Automatisierung** | Nur via ISO-20022 XML-Dateien |
| **Schnittstellen** | E-Banking Upload, payCOMweb, Dateitransfer |
| **Mandatserteilung** | Handschriftliche Unterschrift erforderlich |
| **Gebühren** | ~CHF 0.10-0.50 pro Transaktion |

### Kritische Einschränkung: Einstellung 2028

> **LSV+ und Business Direct Debit (BDD) werden am 30. September 2028 eingestellt.**
> Ab 2026 werden keine neuen Biller mehr für LSV+/BDD aktiviert.

Die Schweizer Banken führen stattdessen **eBill Debit Direct** ein (Sommer 2025).

### Technische Implementation (theoretisch)

```typescript
// ISO-20022 pain.008 XML Generierung
function generateSepaDirectDebit(mandate: Mandate, amount: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${generateMessageId()}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${amount}</CtrlSum>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${mandate.id}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${amount}</CtrlSum>
      <!-- ... weitere 200+ Zeilen XML ... -->
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
}

// Upload zu Bank (manuell oder via SFTP)
async function uploadToBank(xmlContent: string) {
  // Keine API - manueller Upload oder SFTP-Batch
  throw new Error('Keine automatisierte API verfügbar');
}
```

### Fazit Schweiz

| Pro | Contra |
|-----|--------|
| Niedrige Transaktionsgebühren | Keine moderne API |
| Direkte Bankbeziehung | Papier-Mandate erforderlich |
| Keine Drittanbieter-Abhängigkeit | System wird 2028 eingestellt |
| | Hoher manueller Aufwand |
| | Keine Echtzeit-Webhooks |

---

## Option 3: Deutscher Bankeinzug (FinTS/HBCI)

### Was ist FinTS/HBCI?

**FinTS (Financial Transaction Services)**, früher HBCI, ist ein bankenübergreifendes Protokoll für Online-Banking in Deutschland. Es wurde von den deutschen Bankenverbänden entwickelt und wird von ~3000 Kreditinstituten unterstützt.

```
┌─────────────────────────────────────────────────────────────────┐
│                    FinTS/HBCI Architektur                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Deine App          FinTS-Library         Sparkasse/Bank        │
│  ┌─────────┐        ┌─────────────┐       ┌─────────────┐       │
│  │ NestJS  │───────>│ libfintx    │──────>│ FinTS 3.0   │       │
│  │ Backend │        │ python-fints │       │ Server      │       │
│  │         │<───────│ Subsembly   │<──────│             │       │
│  └─────────┘        └─────────────┘       └─────────────┘       │
│                                                                  │
│  Authentifizierung: PIN/TAN (chipTAN, smsTAN, pushTAN)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sparkasse: Technische Möglichkeiten

| Aspekt | Bewertung |
|--------|-----------|
| **API-Zugang** | FinTS 3.0 Protokoll (kein REST) |
| **Libraries** | libfintx (.NET), python-fints, Subsembly |
| **SEPA-Support** | Basislastschrift und Firmenlastschrift |
| **TAN-Verfahren** | chipTAN, smsTAN, pushTAN |
| **Gebühren** | Je nach Kontomodell, oft ~€0.10-0.30 |

### Verfügbare Open-Source-Libraries

```typescript
// Option 1: libfintx (.NET)
// https://github.com/libfintx/libfintx
const client = new FinTsClient({
  blz: '12345678',
  userId: 'username',
  pin: 'pin',
  url: 'https://banking.sparkasse.de/fints'
});

await client.sepaDirectDebit({
  iban: 'DE89370400440532013000',
  bic: 'COBADEFFXXX',
  amount: 9.99,
  mandate: mandateReference,
});

// Option 2: python-fints
// https://github.com/raphaelm/python-fints
```

### SEPA-Firmenlastschrift vs. Basislastschrift

| Merkmal | Basislastschrift | Firmenlastschrift |
|---------|------------------|-------------------|
| **Zielgruppe** | Privatkunden | Firmenkunden |
| **Widerspruchsrecht** | 8 Wochen | Keines |
| **Vorab-Anzeige** | Nein | Ja (beide Banken) |
| **Einsatz** | B2C | B2B |

### Herausforderungen

1. **TAN-Pflicht:** Jede Transaktion erfordert TAN-Bestätigung
2. **Keine Webhooks:** Polling für Statusupdates erforderlich
3. **Komplexes Protokoll:** FinTS ist deutlich komplexer als REST
4. **Mandate-Management:** Selbst zu implementieren
5. **PSD2-Einschränkungen:** Zugang über Drittanbieter reguliert

### Drittanbieter: finAPI

Für eine modernere API gibt es Anbieter wie **finAPI**, die als Middleware zwischen App und Bank fungieren:

```typescript
// finAPI Direct Debit API
const response = await fetch('https://api.finapi.io/v1/payments/directDebit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    accountId: customerAccountId,
    amount: 9.99,
    currency: 'EUR',
    mandateId: mandateReference,
    executionDate: '2026-02-20',
  }),
});
```

**Aber:** finAPI hat eigene Gebühren und ist selbst ein Payment-Provider.

### Fazit Deutschland

| Pro | Contra |
|-----|--------|
| Etablierter Standard (3000+ Banken) | Komplexes Protokoll |
| Open-Source-Libraries verfügbar | TAN für jede Transaktion |
| Niedrige Bankgebühren | Kein Echtzeit-Feedback |
| Keine Drittanbieter nötig (theoretisch) | PSD2-Regulierung |
| | MT-940 wird ab 11/2025 eingestellt |

---

## Option 4: Stripe SEPA-Lastschrift (Kompromiss)

### Der beste beider Welten

Stripe bietet **SEPA Direct Debit** als Zahlungsmethode an - mit den Vorteilen beider Ansätze:

```typescript
// Minimale Code-Änderung in bestehender Integration
const paymentIntent = await stripe.paymentIntents.create({
  amount: 1199, // €11.99
  currency: 'eur',
  payment_method_types: ['sepa_debit'], // Statt 'card'
  customer: stripeCustomerId,
  mandate_data: {
    customer_acceptance: {
      type: 'online',
      online: {
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      },
    },
  },
});
```

### Gebührenvergleich

| Zahlungsmethode | Stripe-Gebühr | Bei €10 |
|-----------------|---------------|---------|
| Kreditkarte (EU) | 1.5% + €0.25 | €0.40 |
| SEPA-Lastschrift | 0.8% (max €5) | €0.08 |
| **Ersparnis** | | **€0.32 pro Transaktion** |

Bei 1000 Transaktionen/Monat: **€320 Ersparnis**

### Vorteile gegenüber direktem Bankeinzug

| Aspekt | Stripe SEPA | Direkt (LSV+/FinTS) |
|--------|-------------|---------------------|
| **API** | REST, moderne SDKs | XML/FinTS, komplex |
| **Mandate** | Digital, sofort | Papier, manuell |
| **Webhooks** | Echtzeit | Keine / Polling |
| **Rückbuchungen** | Automatisch verwaltet | Manuell |
| **Compliance** | Stripe übernimmt | Selbst verantwortlich |
| **Setup** | Minuten | Wochen/Monate |

### Implementation

```typescript
// Frontend: SEPA-Mandat einholen
const { error } = await stripe.confirmSepaDebitPayment(clientSecret, {
  payment_method: {
    sepa_debit: {
      iban: 'DE89370400440532013000',
    },
    billing_details: {
      name: 'Max Mustermann',
      email: 'max@example.com',
    },
  },
});

// Backend: Webhook wie gehabt
@Post('webhook')
async handleWebhook(@Req() req: Request) {
  const event = this.stripe.webhooks.constructEvent(/*...*/);

  switch (event.type) {
    case 'payment_intent.succeeded':
      // Funktioniert identisch wie bei Kreditkarten
      await this.handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      // SEPA kann auch fehlschlagen (Kontodeckung, etc.)
      await this.handlePaymentFailure(event.data.object);
      break;
  }
}
```

---

## Vergleichsmatrix

| Kriterium | Stripe Karte | Stripe SEPA | LSV+ (CH) | FinTS (DE) |
|-----------|--------------|-------------|-----------|------------|
| **Gebühren** | 1.5-2.9% | 0.8% | ~0.1-0.5 CHF | ~0.1-0.3 € |
| **API-Qualität** | Excellent | Excellent | Keine | Komplex |
| **Setup-Zeit** | Stunden | Stunden | Wochen | Wochen |
| **Mandate** | Digital | Digital | Papier | Papier |
| **Webhooks** | Ja | Ja | Nein | Nein |
| **Compliance** | Stripe | Stripe | Selbst | Selbst |
| **Vendor Lock-in** | Ja | Ja | Nein | Nein |
| **Zukunftssicher** | Ja | Ja | Nein (2028) | Eingeschränkt |
| **Empfohlen** | Standard | **Beste Wahl** | Nein | Nein |

---

## Entscheidung & Empfehlung

### Entscheidung: Stripe SEPA-Lastschrift aktivieren

Nach Analyse aller Optionen ist die Empfehlung:

1. **Stripe SEPA-Lastschrift** als primäre Zahlungsmethode für DACH-Kunden
2. **Kreditkarte** als Fallback für internationale Kunden
3. **Kein direkter Bankeinzug** - Aufwand/Nutzen-Verhältnis nicht gegeben

### Begründung

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kosten-Nutzen-Analyse                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Direkter Bankeinzug:                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Entwicklungsaufwand:     ~80-160 Stunden                │    │
│  │ Wartungsaufwand:         ~10 Stunden/Monat              │    │
│  │ Ersparnis pro Transaktion: €0.05-0.10                   │    │
│  │ Break-Even bei:          >10.000 Transaktionen/Monat   │    │
│  │ Risiko:                  Hoch (Compliance, Edge Cases)  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Stripe SEPA-Lastschrift:                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Entwicklungsaufwand:     ~2-4 Stunden                   │    │
│  │ Wartungsaufwand:         ~0 Stunden/Monat               │    │
│  │ Ersparnis pro Transaktion: €0.32 vs. Kreditkarte        │    │
│  │ Break-Even bei:          Sofort                         │    │
│  │ Risiko:                  Niedrig (Stripe übernimmt)     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Nächste Schritte

#### Bereits erledigt (Code)

- [x] `stripe.service.ts` - SEPA zu Checkout Sessions hinzugefügt
- [x] `subscriptions.service.ts` - SEPA für Subscriptions aktiviert
- [x] `stripe-webhook.controller.ts` - SEPA-Dokumentation und `processing` Event

#### Manuell im Stripe Dashboard

1. **SEPA-Lastschrift aktivieren:**
   - Öffne: https://dashboard.stripe.com/settings/payment_methods
   - Finde "SEPA Direct Debit" → Klicke "Turn on"
   - Akzeptiere die SEPA-Bedingungen

2. **Webhook-Event hinzufügen:**
   - Öffne: https://dashboard.stripe.com/webhooks
   - Klicke auf deinen Webhook (Endpoint: `/webhooks/stripe`)
   - Klicke "Update details" → Events
   - Füge hinzu: `payment_intent.processing`
   - Speichern

3. **Deployment:**
   ```bash
   # Auf dem Server
   ssh mana-server
   cd ~/projects/managarten
   git pull
   ./scripts/mac-mini/deploy.sh
   ```

### Langfristige Option

Falls das Transaktionsvolumen >10.000/Monat erreicht, kann eine direkte Bank-Integration erneut evaluiert werden - dann aber mit **eBill Debit Direct** (Schweiz, ab 2025) oder einem **PSD2-konformen Aggregator** (EU).

---

## Quellen

### Schweiz

- [Raiffeisen LSV+](https://www.raiffeisen.ch/rch/de/privatkunden/konten-und-bezahlen/lsv-plus.html)
- [SIX Direct Debits](https://www.six-group.com/en/products-services/banking-services/billing-and-payments/direct-debits.html)
- [Moneyland Direct Debit FAQ](https://www.moneyland.ch/en/direct-debits-switzerland-faq)
- [Guide to Swiss Payments (Atlar)](https://www.atlar.com/blog/guide-to-swiss-payments)

### Deutschland

- [Sparkasse SEPA-Lastschrift](https://www.sparkasse.de/unsere-loesungen/firmenkunden/konten-karten/sepa-lastschrift.html)
- [FinTS Wikipedia](https://en.wikipedia.org/wiki/FinTS)
- [libfintx GitHub](https://github.com/libfintx/libfintx)
- [python-fints GitHub](https://github.com/raphaelm/python-fints)
- [Subsembly FinTS API](https://subsembly.com/fints-api.html)
- [finAPI](https://www.finapi.io/en/home/)

### Stripe

- [Stripe SEPA Direct Debit](https://stripe.com/docs/payments/sepa-debit)
- [Stripe Pricing](https://stripe.com/de/pricing)

---

## Changelog

| Datum | Änderung |
|-------|----------|
| 2026-02-16 | Initial version, Entscheidung für Stripe SEPA |
