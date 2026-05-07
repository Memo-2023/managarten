# Cards — Konkurrenz-Analyse (Mai 2026)

> Stand: 2026-05-07. Quellen primär aus offiziellen Pricing-Seiten, G2/Trustpilot/Reddit/HN sowie Wikipedia/Crunchbase. Wo Daten fehlen oder nicht öffentlich sind, ist das explizit vermerkt. Preise schwanken regional/saisonal — die hier genannten Zahlen sind Listenpreise USD, sofern nicht anders angegeben.

---

## 1. Executive Summary

- **Anki bleibt der unschlagbare technische Gold-Standard**, aber UX-Schwächen (FSRS-„Difficulty Hell", Plugin-Hölle, kein natives Cloud-Sync mit Bildern) und der $25 iOS-Preis sind reale Lücken, in die wir stoßen können. Die Übergabe an AnkiHub im Februar 2026 könnte mittelfristig die Open-Source-Dynamik verändern — Beobachten lohnt.
- **Quizlet hat seine eigene Userbase verärgert**: Trustpilot 1.4/5, massive Beschwerden über Paywalls für Funktionen, die früher gratis waren. Genau dieses Vertrauensvakuum füllen Knowt und potenziell wir.
- **AI-Karten-Generierung ist Tischeinsatz, kein Differenzierer mehr.** Quizlet, Quizgecko, Knowt, RemNote, Wisdolia, sogar Memrise haben es. PDF-Import + KI ist erwartete Baseline.
- **Die „beautiful Anki"-Lücke ist umkämpft**: Mochi (5$/mo), RemNote (8$/mo), Noji (vormals AnkiPro). Cards mit _kostenlosem_ Sync sticht heraus — niemand sonst bietet die Kombination Markdown + FSRS + Cloud-Sync gratis. Das ist unsere wichtigste objektive Differenzierung.
- **Brand-Sniping ist real und schädlich**: AnkiPro (jetzt Noji) und AnkiApp (jetzt AlgoApp) haben sich einen Ruf als „Anki-Klone, die täuschen" erarbeitet — inkl. eines 10-tägigen Sync-Outages bei AnkiPro im Mai 2025. Lehre für uns: nie Anki im Namen führen, Kompatibilität sauber kommunizieren.

---

## 2. Vergleichstabelle

| Konkurrent                     | USP-Kurz                               | Lizenz                      | Free-Tier                        | Pro-Preis                                       | Bedrohung                        |
| ------------------------------ | -------------------------------------- | --------------------------- | -------------------------------- | ----------------------------------------------- | -------------------------------- |
| **Anki (Desktop/Web/Android)** | Tech-Gold-Standard, FSRS, Add-ons      | AGPL-3.0                    | Voll-Funktional gratis           | $0 (iOS: $24.99-29.99 lifetime)                 | **Hoch**                         |
| **AnkiHub**                    | Kollaborative Anki-Decks (USMLE-Fokus) | proprietär (auf Anki-Basis) | Trial                            | $5/mo                                           | Mittel (Power-User)              |
| **Quizlet**                    | Marktführer Volumen + Schule           | proprietär                  | Sehr eingeschränkt, viele Ads    | $35.99/Jahr (Plus), ~$45/Jahr (Unlimited)       | **Hoch** (Reichweite)            |
| **RemNote**                    | Notes + SR Hybrid                      | proprietär                  | Großzügig (3 PDFs, 5 Image-Occ.) | $8/mo annual (Pro)                              | Mittel                           |
| **Mochi**                      | Markdown, Local-First, schickes UI     | proprietär                  | Single-Device                    | $5/mo (Sync)                                    | **Hoch** (direkter Wettbewerber) |
| **Brainscape**                 | Confidence-Based-Repetition            | proprietär                  | Limited Decks                    | ~$19.99/mo, $79.99 lifetime                     | Gering-Mittel                    |
| **Memrise**                    | Sprachen + AI-Buddies                  | proprietär                  | Eingeschränkt                    | $130.99/Jahr, $199.99 lifetime                  | Gering (Nische Sprachen)         |
| **SuperMemo**                  | Algorithmus-Urvater (SM-20)            | proprietär                  | Monatstrial Mobile               | ~9.90$/mo Mobile, ~$66 Desktop perp.            | Gering (Nische, sperrige UX)     |
| **AnkiPro / Noji**             | „Anki-Look" mit modernem UI            | proprietär                  | mit Ads/Limits                   | nicht öffentlich klar (~$5-10/mo)               | Mittel (Brand-Verwirrung)        |
| **AnkiApp / AlgoApp**          | Cloud-First Closed-Source              | proprietär                  | Limited                          | Subscription (Details schwammig)                | Gering (Reputation kaputt)       |
| **Quizgecko**                  | AI-First (Quizzes, Podcasts)           | proprietär                  | 1 AI-Lesson/Monat                | $16/mo (Pro), $29 (Ultra)                       | Mittel (AI-Side)                 |
| **Knowt**                      | „Free Quizlet-Alternative" + AI        | proprietär                  | Sehr großzügig                   | $9.99/mo (Ultra)                                | **Hoch** (gleiches Spielfeld)    |
| **Wisdolia**                   | Browser-Ext: Karten aus Webcontent     | proprietär                  | 50 Sets/Monat                    | $2.50/mo, $25/Jahr                              | Gering                           |
| **Mnemosyne**                  | Open-Source, Forschungs-Datasammlung   | GPL                         | Voll gratis                      | —                                               | Sehr gering                      |
| **Traverse**                   | Mind-Maps + SR (Mandarin Blueprint)    | proprietär                  | Free-Plan                        | $15/mo Member, $35/User Enterprise              | Gering                           |
| **Cerego**                     | Enterprise B2B Adaptive Learning       | proprietär                  | —                                | ab $8.33/mo Indiv., Enterprise on req.          | Sehr gering (B2B)                |
| **NeuraCache**                 | Notion/Obsidian-Sync für SR            | proprietär                  | Limited                          | 14d Trial → Pro (Preis nicht klar dokumentiert) | Gering                           |

> Threat-Ranking: nur **Anki, Quizlet, Mochi, Knowt** sind Top-Bedrohungen für Cards' Kernzielgruppe. RemNote, Quizgecko, AnkiPro/Noji sind Nebenfront.

---

## 3. Detail-Sektion pro Konkurrent

### 3.1 Anki (Desktop / AnkiWeb / AnkiDroid / AnkiMobile)

- **URL:** https://apps.ankiweb.net/
- **Plattformen:** Windows, macOS, Linux (Desktop), Web (AnkiWeb), Android (AnkiDroid), iOS (AnkiMobile)
- **USP:** Der etablierte technische Standard für Spaced Repetition; mächtig, erweiterbar (Add-ons), FSRS v6 nativ, riesiges Deck-Ökosystem (insbes. Medizin: AnKing).
- **Lizenz:** AGPL-3.0 (Desktop, AnkiDroid, Web). AnkiMobile iOS proprietär (finanziert die Open-Source-Arbeit).
- **Kosten:** Desktop / Web / Android **kostenlos**. AnkiMobile iOS: **$24.99-29.99 einmalig (Lifetime)**. AnkiHub-Cloud-Decks: $5/Monat (separat).
- **User loben:** Mächtig & flexibel; FSRS-Wirksamkeit; freie Decks (insbes. AnKing Step Deck mit 100k+ Studenten); Dauerhaftigkeit (seit 2006).
- **User kritisieren:** Steile UX-Lernkurve; FSRS-„Difficulty Hell" (Karten reifen langsam, Reviews explodieren); Plugin-Brüche zwischen Versionen; iOS-Preis abschreckend; Sync-Setup für Bilder/Audio umständlich.
- **Firma & Geschichte:** Damien Elmes (Australien), gestartet 5.10.2006 ursprünglich für Japanisch-Lernen. Im **Februar 2026** angekündigt, dass AnkiHub (Austin, TX) Business-Operations und Open-Source-Stewardship übernimmt — Anki bleibt Open Source, keine externen Investoren, Versprechen „no enshittification".
- **Bedrohungsgrad: Hoch.** Power-User-Standard, riesiges Decks-Ökosystem, kostenlos. Wir können sie nicht im technischen Spielfeld schlagen — wir müssen über UX, Onboarding und „Anki-Import-Bridge" gewinnen.

Quellen: [Anki Wikipedia](<https://en.wikipedia.org/wiki/Anki_(software)>) · [AnkiMobile App Store](https://apps.apple.com/us/app/ankimobile-flashcards/id373493387) · [Class Central: Anki founder steps back](https://www.classcentral.com/report/anki-founder-steps-back/) · [AnkiHub](https://www.ankihub.net/) · [Difficulty Hell in Anki](https://skerritt.blog/difficulty-hell-in-anki/) · [Anki FSRS-Forum](https://forums.ankiweb.net/c/fsrs/41)

---

### 3.2 Quizlet

- **URL:** https://quizlet.com/
- **Plattformen:** Web, iOS, Android.
- **USP:** Massen-Marktführer mit der größten Bibliothek shared decks (Schul-/Hochschul-Vokabeln); inzwischen stark AI-fokussiert (Q-Chat, Magic Notes, Coconote-Akquisition Feb 2026, ChatGPT-Integration März 2026).
- **Lizenz:** Proprietär.
- **Kosten:** Free (sehr eingeschränkt + Werbung). **Plus: $35.99/Jahr (~$2.99/mo)**. **Plus Unlimited: ~$44.99/Jahr** (entfernt Limits wie 3 Practice Tests/Monat, 20 Learn-Runden/Monat).
- **User loben:** Riesige Library shared sets; einfacher Einstieg; Multi-Device gut etabliert; AI-generierte Practice-Tests sind brauchbar.
- **User kritisieren:** **Trustpilot 1.4/5** aus 500+ Reviews. Aggressives Paywalling von Features, die früher gratis waren (Learn-Mode, Test, Lernrunden-Limit); Werbeflut im Free-Tier; Export-Möglichkeiten eingeschränkt (Lock-in); Bugs.
- **Firma & Geschichte:** 2005 gegründet von Andrew Sutherland (damals 15, Albany High School CA) für eigene Französisch-Vokabeln. Bootstrap bis 2015, dann $12M USV/Costanoa. 2020 $30M Series C bei General Atlantic, **$1B Bewertung**. Sitz San Francisco. Insgesamt ~$62M raised. CEO seit 2022 Lex Bayer. **Februar 2026: Akquisition Coconote**.
- **Bedrohungsgrad: Hoch (Reichweite), aber verwundbar.** Das Trustpilot-Desaster ist eine Steilvorlage. Unsere Chance: Quizlet-Refugees mit „so gut wie früher Quizlet, dazu FSRS und ohne Paywall-Gärten" abholen.

Quellen: [Quizlet Wikipedia](https://en.wikipedia.org/wiki/Quizlet) · [Trustpilot Quizlet (1.4/5)](https://www.trustpilot.com/review/www.quizlet.com) · [Quizlet $1B Bewertung TechCrunch](https://techcrunch.com/2020/05/13/quizlet-valued-at-1-billion-as-it-raises-millions-during-a-global-pandemic/) · [Crunchbase Quizlet](https://www.crunchbase.com/organization/quizlet) · [Navigating Quizlet's Controversial Changes](https://medium.com/@maxtan0626/navigating-quizlets-controversial-changes-afeb97aafd1e)

---

### 3.3 RemNote

- **URL:** https://www.remnote.com/
- **Plattformen:** Web, macOS, Windows, iOS, Android.
- **USP:** Hybrid aus Outliner-Notetaking (Roam-/Logseq-ähnlich) und integrierten SR-Karten — Karten entstehen direkt im Notiz-Flow via `::`-Syntax. Plus PDF-Annotation und Image-Occlusion.
- **Lizenz:** Proprietär.
- **Kosten:** Free (3 PDF-Annotationen, 5 Image-Occlusion-Karten). **Pro: $8/Monat annual ($96/Jahr)** oder $10/mo monthly.
- **User loben:** Notes + Cards in _einem_ Workflow; flexible nested Outline-Struktur; PDF-Annotation; AI-Generierung aus Notizen/PDFs.
- **User kritisieren:** Steile Lernkurve („nichts versteht man in 10 Min"); UI als überladen empfunden; **Performance-Probleme** (langsam beim Laden großer Datenbanken, iPad-Stabilität); Bugs nach Beta-Updates; non-English-Support schwach.
- **Firma & Geschichte:** Gegründet 2019 von Martin Schneider (MIT) und Moritz Wallawitsch (Berlin, HTW). Sitz: USA. **$2.8M Seed (Sept 2021)** unter General Catalyst. Hat 2025 ~$2M Revenue mit ~18 Personen erreicht.
- **Bedrohungsgrad: Mittel.** Andere Zielgruppe (PKM-Power-User, Studenten, die Notes wollen). Cards ist fokussierter — wir müssen die „nur-Karten"-Nische gegen ihre Hybrid-Erweiterung verteidigen.

Quellen: [RemNote Pricing](https://www.remnote.com/pricing) · [Crunchbase RemNote](https://www.crunchbase.com/organization/remnote) · [RemNote Reviews Product Hunt](https://www.producthunt.com/products/remnote/reviews) · [RemNote Performance-Forum](https://forum.remnote.io/t/remnote-is-my-dream-pkm-yet-its-too-slow-am-i-doing-something-wrong/10920) · [Latka RemNote $2M ARR](https://getlatka.com/companies/remnote.com)

---

### 3.4 Mochi

- **URL:** https://mochi.cards/
- **Plattformen:** macOS (Intel/AS), Windows, Linux Desktop, iOS, Android, Web.
- **USP:** Markdown-First, sauberes minimalistisches UI, Local-First mit Offline-Support; Image-Occlusion und Anki-`.apkg`-Import als First-Class-Feature ohne Plugin-Frickelei. **FSRS seit Mid-2025 unterstützt.**
- **Lizenz:** Proprietär.
- **Kosten:** Free (Single-Device, alle Karten lokal). **Pro: $5/Monat** (Sync, mehrere Geräte, Translations).
- **User loben:** „schönes" UI; intuitiver als Anki; sofortiges Karten-Lernen ohne Onboarding-Friktion; Anki-Import als Plugin-Free-Feature; Markdown-Workflow.
- **User kritisieren:** Sync nur in Pro (Single-Device-Free fühlt sich begrenzt an); algorithm war bis Mid-2025 schwächer als Anki (FSRS-Beta hat das gefixt); kleinere Community → weniger shared decks; Solo-Developer (Bus-Faktor).
- **Firma & Geschichte:** Solo-Projekt von **Matthew Steedman**, eigenfinanziert, Forum auf forum.mochi.cards. Keine externen Investoren öffentlich bekannt.
- **Bedrohungsgrad: Hoch — direktester Wettbewerber.** Praktisch identische Positionierung (Markdown, schickes UI, modern, FSRS, Local-First). Unterschied: Mochi nimmt $5/mo für Sync — **wir bieten Sync gratis**, das ist unsere stärkste objektive Differenzierung gegen Mochi.

Quellen: [Mochi Cards](https://mochi.cards/) · [Mochi App Store](https://apps.apple.com/us/app/mochi-flashcards-and-notes/id1507775056) · [First Impressions of Mochi (borretti.me)](https://borretti.me/article/first-impressions-mochi) · [Bunpro: If you don't like Anki, try Mochi](https://community.bunpro.jp/t/if-you-dont-like-anki-consider-giving-mochi-a-try/59955) · [Mochi Changelog](https://mochi.cards/changelog/)

---

### 3.5 Brainscape

- **URL:** https://www.brainscape.com/
- **Plattformen:** Web, iOS, Android.
- **USP:** „Confidence-Based Repetition" — User raten Selbsteinschätzung auf 1-5-Skala (statt SM-2/FSRS), als wissenschaftlich vermarktetes Schedule-System. Große kuratierte Decks-Library und EDU/Enterprise-Vertrieb.
- **Lizenz:** Proprietär.
- **Kosten:** Free (limitierter Zugang zu Deck-Bibliothek). **Pro: ~$19.99/Monat** (Discounts bei Jahres-/Lifetime-Plan). **Lifetime: $79.99**.
- **User loben:** Kuratierte Content-Bibliothek; klares Lernkonzept; schickes UI; gute Statistiken; Collaboration-Features für Teams.
- **User kritisieren:** Algorithmus weniger anpassbar als Anki/FSRS; Pro-Preis wird als hoch empfunden; Free-Tier-Decks sehr begrenzt; weniger Power-User-Features.
- **Firma & Geschichte:** Gegründet von Andrew Cohen (Idee 2006 Panama-Spanisch-Excel-Macro, später Master's Columbia EdTech). Sitz: New York. Founding Team: Cohen, Andy Lutz, Jay Stramel, Jonathan Thomas, Ron Cadet (2018). >$3M raised bis 2015.
- **Bedrohungsgrad: Gering-Mittel.** Andere Zielgruppe (Pro-Decks-Käufer, EDU-Markt). Wir konkurrieren wenig direkt.

Quellen: [Brainscape](https://www.brainscape.com/) · [G2 Brainscape Reviews](https://www.g2.com/products/brainscape/reviews) · [Brainscape Wikipedia](https://en.wikipedia.org/wiki/Brainscape) · [How Brainscape Was Born](https://www.brainscape.com/academy/how-brainscape-was-born/)

---

### 3.6 Memrise

- **URL:** https://www.memrise.com/
- **Plattformen:** Web, iOS, Android.
- **USP:** Sprachen-Fokus mit Native-Speaker-Videos und seit 2024/25 stark ausgebaute „AI Buddies" (Grammar Buddy, Translator Buddy, Culture Buddy, MemBot Chatbot auf GPT-Basis).
- **Lizenz:** Proprietär.
- **Kosten:** Free (limitiert + Ads). **Monthly $27.99**, **Annual $130.99 (~$11/mo)**, **Lifetime $199.99** (oft Discounts bis 50%).
- **User loben:** Native-Speaker-Video-Clips als Alleinstellungsmerkmal vs Duolingo; AI-Buddies bringen Konversationspraxis; gut für Vokabel-Aufbau.
- **User kritisieren:** Schwach in Grammatik; nicht für Fortgeschrittene; AI-Buddies hinter Paywall; teure Subscription verglichen mit Konkurrenten; legendäre community-„mems"-Funktion wurde entfernt (alte Community vergrätzt).
- **Firma & Geschichte:** Gegründet 2010 von **Ed Cooke** (Grand Master of Memory), **Ben Whately** und **Greg Detre** (Princeton-Neurowissenschaftler). Oxford-Trio. Sitz London. **$25.3M raised** über 7 Runden / 10 Investoren. Profitabel seit Ende 2016. **72M registrierte User (2024)**.
- **Bedrohungsgrad: Gering.** Sprach-Lerner-Nische, kaum Überlappung mit unserer generischen SR-Zielgruppe.

Quellen: [Memrise](https://www.memrise.com/) · [Memrise Wikipedia](https://en.wikipedia.org/wiki/Memrise) · [Crunchbase Memrise](https://www.crunchbase.com/organization/memrise) · [Business of Apps: Memrise Statistics 2026](https://www.businessofapps.com/data/memrise-statistics/)

---

### 3.7 SuperMemo

- **URL:** https://www.supermemo.com/ (Web/Mobile) · https://supermemo.store/ (Desktop)
- **Plattformen:** Windows Desktop (Premium-Version), Web, iOS, Android, Browser-API.
- **USP:** Originator des Spaced-Repetition-Konzepts (1985 ff.) — Algorithmen SM-2 bis aktuell **SM-20 (2026)**. Die Desktop-Version hat Funktionen, die andere SR-Tools nicht haben (Incremental Reading, Concept Maps).
- **Lizenz:** Proprietär.
- **Kosten:** Mobile/Web: 1 Monat free, danach **~9.90 USD/EUR pro Monat**. Desktop SuperMemo 19 (Windows): **~$66 perpetual** (Käufer März 2026 bekommen kostenloses Upgrade auf SuperMemo 20). API: Early Access, 100 Repetitions/Tag gratis.
- **User loben:** Algorithmus-Tiefe; Incremental Reading; SM-20 als state-of-the-art; Hardcore-Power-User-Tool.
- **User kritisieren:** UI „aus den 1990ern"; sperrige Bedienung; Desktop-only für viele Features; Mobile-App stark eingeschränkt; Preis vs Anki nicht zu rechtfertigen für 95% der User.
- **Firma & Geschichte:** SuperMemo World Sp. z o.o., gegründet **5. Juli 1991** in Poznań, Polen, von Krzysztof Biedalak und **Piotr Wozniak** (mit Tomasz Kuehn, Janusz Murakowski, Marczello Georgiew). Wozniak begann SuperMemo 1.0 schon 13.12.1987.
- **Bedrohungsgrad: Gering.** Nische für Algorithmus-Enthusiasten und Incremental-Reading-Fans. Keine reale UX-Bedrohung für uns.

Quellen: [SuperMemo Wikipedia](https://en.wikipedia.org/wiki/SuperMemo) · [SuperMemo Store](https://supermemo.store/products/supermemo-19-for-windows) · [Algorithm SM-18](https://supermemo.guru/wiki/Algorithm_SM-18) · [Piotr Wozniak](https://supermemo.guru/wiki/Piotr_Wozniak) · [SuperMemo iOS App Store](https://apps.apple.com/us/app/supermemo-effective-learning/id982498980)

---

### 3.8 AnkiPro / Noji

- **URL:** https://noji.io/ (vormals ankipro.net)
- **Plattformen:** iOS, Android, Web.
- **USP:** „Anki-Look-and-Feel" mit modernem UI und Cloud-Sync — verkauft sich aktiv als „die einfachere Anki-Variante". Nicht kompatibel mit echtem Anki (auch nicht mit `.apkg`-Decks ohne Workarounds).
- **Lizenz:** Proprietär.
- **Kosten:** Free mit Werbung/Limits. Pro-Subscription, Preise nicht prominent — nach Reports im Bereich **$5-10/mo** oder Jahresplan.
- **User loben:** Schickes Mobile-UI; einfacher Onboarding-Flow; Cross-Device-Sync „out of the box"; community Decks.
- **User kritisieren:** **Brand-Verwirrung** (User dachten, sie laden „echtes" Anki herunter); **10-Tage-Sync-Outage Mai 2025** mit Datenverlust für viele User; Lock-in (Export-Tools wurden vom Anbieter blockiert, ein Migrations-Tool erhielt einen **Rickroll-Response** von AnkiPro); offizielles Anki-Team distanziert sich.
- **Firma & Geschichte:** Anki Pro UAB; Co-Founder **Maksim Abramchuk** (im Crunchbase) und **Andrew Bond** (LinkedIn). 2021 gestartet, 2024/25 Rebrand zu **Noji**. Sitz nicht eindeutig öffentlich (LinkedIn-Indikatoren UK/Osteuropa).
- **Bedrohungsgrad: Mittel.** Nicht weil sie technisch besser sind, sondern weil Anki-Suchende auf sie reinfallen. **Lehre für Cards: Brand-Hygiene**. Wir sind „Cards" — nie „Anki" im Marketing, klare Trennung kommunizieren, Anki-Import sauber als Bridge dokumentieren.

Quellen: [Anki knockoffs (offizielle Anki FAQ)](https://faqs.ankiweb.net/anki-knockoffs.html) · [AnkiPro Ripoff Forum](https://forums.ankiweb.net/t/ankipro-another-ripoff-anki-app/11791) · [Anki Users Get Rickrolled](https://broderic.blog/post/anki-users-get-rickrolled/) · [Noji App Store](https://apps.apple.com/us/app/noji-flashcards-anki-method/id1573585542) · [Crunchbase Anki Pro](https://www.crunchbase.com/organization/anki-pro) · [Speakada: Official Anki vs Fake Apps](https://speakada.com/official-anki-vs-fake-apps-the-critical-mistake-costing-language-learners-hours/)

---

### 3.9 AnkiApp / AlgoApp

- **URL:** https://www.algoapp.ai/ (vormals ankiapp.com)
- **Plattformen:** iOS, Android, Web, Desktop.
- **USP:** Closed-Source Cloud-First Karten-App, die seit Jahren den Namen „Anki" ausnutzt. **In manchen Regionen (z. B. japanischer App Store) firmiert sie weiterhin als „AnkiApp"**.
- **Lizenz:** Proprietär.
- **Kosten:** Free + Subscription-Tiers (Details vage, oft als „Trial-Trap" kritisiert).
- **User loben:** Funktioniert auf allen Plattformen; Cloud-Sync inkludiert; einfaches UI.
- **User kritisieren:** **Komplette Brand-Täuschung**; kein Import/Export zu echtem Anki; aggressive Subscription-Walls; Reviews mit „nichts mit echtem Anki zu tun" als wiederkehrendes Muster; Reputation in der Community unter null.
- **Firma & Geschichte:** AlgoApp Inc., gegründet **2021**, Sitz **San Mateo, CA**. Vor Kurzem von AnkiApp zu AlgoApp umbenannt (Anki-Brand-Druck wurde zu groß), aber teils noch unter altem Namen aktiv.
- **Bedrohungsgrad: Gering.** Reputation kaputt; informierte User meiden sie aktiv. Hauptthema für uns ist nicht Wettbewerb, sondern Brand-Hygiene-Lehre (siehe AnkiPro).

Quellen: [Anki knockoffs FAQ](https://faqs.ankiweb.net/anki-knockoffs.html) · [AlgoApp on Anki Forum](https://forums.ankiweb.net/t/algoapp-still-using-ankiapp-name-in-japanese-app-store/69103) · [Crunchbase AlgoApp](https://www.crunchbase.com/organization/algoapp) · [Pitchbook AlgoApp](https://pitchbook.com/profiles/company/495884-44)

---

### 3.10 Quizgecko

- **URL:** https://quizgecko.com/
- **Plattformen:** Web, iOS, Android.
- **USP:** AI-First-Workflow: aus PDF / Text / URL → Quizzes + Karten + Notizen + **Audio-Podcasts** (Notebook-LM-ähnlich). SR ist sekundär.
- **Lizenz:** Proprietär.
- **Kosten:** **Basic Free (1 AI-Lesson/Monat)**. **Pro $16/mo** (annual). **Ultra $29/mo** (50 Podcasts/mo, Custom Prompts). Business $32/mo (API + Branding).
- **User loben:** Vielseitige Output-Formate (Quiz/Karten/Podcast); guter PDF-Parser; multi-Question-Types.
- **User kritisieren:** SR ist „mitgeliefert" aber nicht der Fokus; Free-Tier sehr eng (1 Lesson); Pro-Preis hoch verglichen mit dedicated AI-Card-Tools.
- **Firma & Geschichte:** Privates Startup, kleinere Bekanntheit, keine prominente Funding-Information öffentlich.
- **Bedrohungsgrad: Mittel (in der AI-Front).** Wir konkurrieren am AI-Generierungs-Feature. Für reines SR-Lernen ist Quizgecko keine Bedrohung; für „ich habe ein Skript und will lernen" schon. Unser Konter: AI-Generierung ist bei uns „free with sync" und dann _dauerhaft_ in einem echten SR-System.

Quellen: [Quizgecko](https://quizgecko.com/) · [Quizgecko Pricing](https://quizgecko.com/pricing) · [Toosio Quizgecko Review 2026](https://toosio.com/tool/quizgecko-ai-quiz-flashcard-podcast-generator)

---

### 3.11 Knowt

- **URL:** https://knowt.com/
- **Plattformen:** Web, iOS, Android.
- **USP:** Positioniert sich explizit als **„free Quizlet alternative"**. Importiert Quizlet-Sets direkt, hat ähnliche Study-Modes (Learn, matching, practice tests, „Knowt Play") plus AI-Generierung aus Notizen/PDFs.
- **Lizenz:** Proprietär.
- **Kosten:** **Sehr großzügiges Free-Tier** (unlimited Karten, alle Study-Modes, basic AI mit monatlichen Limits). **Ultra: $9.99/mo annual** (Snap & Solve, unlimited AI). Manche Listen nennen einen $12.50/mo Premium.
- **User loben:** „Endlich Quizlet ohne Paywall"; Quizlet-Import funktioniert; AI-Note-zu-Karten brauchbar; Free-Tier wirklich nutzbar.
- **User kritisieren:** Hauptsächlich Schüler-/US-Highschool-Zielgruppe (für Erwachsene weniger durchdacht); AI-Limits im Free-Tier; SR-Algorithmus weniger ausgereift als Anki/FSRS.
- **Firma & Geschichte:** US-Startup, primär Studenten-Zielgruppe, keine prominente Funding-Information öffentlich verfügbar.
- **Bedrohungsgrad: Hoch (gleiches Spielfeld).** Beide Apps positionieren „free + AI + bessere UX als Quizlet". Unsere Differenzierung: **FSRS v6, Markdown, echtes Local-First-PWA-Modell, Anki-Import inkl. Bilder/Audio**. Knowt ist webbasiert, wir sind installierbar offline-first.

Quellen: [Knowt](https://knowt.com/) · [Knowt vs Quizlet (StudyGenie 2026)](https://studygenie.io/blog/knowt-vs-quizlet) · [Best Quizlet Alternatives 2026](https://kvistly.com/blog/best-quizlet-alternatives)

---

### 3.12 Wisdolia

- **URL:** https://www.wisdolia.com/ (vorrangig als Chrome-Extension)
- **Plattformen:** Chrome Extension; Karten-Export zu Anki möglich.
- **USP:** Generiert Karten aus _jeder Webseite, PDF oder YouTube-Video_ in Sekunden — sehr fokussiert auf den „Capture beim Browsen"-Use-Case.
- **Lizenz:** Proprietär.
- **Kosten:** **Free: 50 Sets/Monat** (Limit: 15 PDF-Seiten, 12 Min YouTube). **Pro: $2.50/mo oder $25/Jahr** (unlimited).
- **User loben:** Spielerisch billig; Browser-Extension-Workflow ist reibungsarm; Anki-Export als Bridge.
- **User kritisieren:** Kein eigenes SR-System mit eigener Tiefe (eher Generator als Lern-App); Browser-only beschränkt.
- **Firma & Geschichte:** Kleines indie-Projekt; keine prominente Funding-Information öffentlich.
- **Bedrohungsgrad: Gering.** Komplementäres Tool eher als Wettbewerber — wer Wisdolia nutzt, exportiert oft _zu Anki_ (oder zu uns, wenn wir Wisdolia-Export sauber importieren).

Quellen: [Wisdolia (Findmyaitool)](https://findmyaitool.com/tool/wisdolia) · [Wisdolia Plain English Walkthrough](https://plainenglish.io/artificial-intelligence/wisdolia-ai-generate-flashcards-anywhere-on-the-web-with-google-chrome-extension)

---

### 3.13 Mnemosyne

- **URL:** https://mnemosyne-proj.org/
- **Plattformen:** Windows, macOS, Linux Desktop; Android (eingeschränkt).
- **USP:** Open-Source-Alternative zu Anki mit explizitem **Forschungs-Fokus**: Nutzer können (opt-in) anonyme Lerndaten beitragen, die seit 2006 zur Untersuchung von Langzeitgedächtnis gesammelt werden.
- **Lizenz:** GPL.
- **Kosten:** Komplett gratis. Kein Sync.
- **User loben:** Sauber, leichtgewichtig, ehrlich akademisch; gut für Forschung; lange Geschichte (>20 Jahre).
- **User kritisieren:** UI veraltet; Mobile-Support schwach (Android-App OK, iOS quasi nichts); kleine Community; weniger Decks als Anki.
- **Firma & Geschichte:** Community-Projekt um Peter Bienstman (Belgien). Letzte Release März 2026 — aktiv aber langsam.
- **Bedrohungsgrad: Sehr gering.** Akademisches Nischen-Tool, andere Zielgruppe.

Quellen: [Mnemosyne Wikipedia](<https://en.wikipedia.org/wiki/Mnemosyne_(software)>) · [Mnemosyne Project](https://mnemosyne-proj.org/) · [GitHub Mnemosyne](https://github.com/mnemosyne-proj/mnemosyne)

---

### 3.14 Traverse

- **URL:** https://traverse.link/
- **Plattformen:** Web, iOS, Android.
- **USP:** Kombiniert Mind-Mapping + Note-Taking + SR-Karten in einer App; offizielle Integration mit „Mandarin Blueprint" (Chinesisch-Lernkurs).
- **Lizenz:** Proprietär.
- **Kosten:** Free, **Member $15/mo**, **Enterprise $35/User/mo**.
- **User loben:** Mind-Map + Karten kombiniert ist konzeptionell stark für Sprachen/komplexe Domains; Mandarin-Community schätzt es.
- **User kritisieren:** Member-Preis hoch; relativ kleine Bekanntheit außerhalb Mandarin-Sub-Community; nicht so viel feature parity mit Anki.
- **Firma & Geschichte:** Indie-Startup, primär Bootstrap; keine prominente Funding-Information öffentlich.
- **Bedrohungsgrad: Gering.** Andere Zielgruppe (visuelles Lernen, Sprachen). Keine direkte Konkurrenz.

Quellen: [Traverse.link](https://traverse.link/) · [Traverse.link Capterra 2026](https://www.capterra.com/p/234102/Traverse/)

---

### 3.15 Cerego

- **URL:** https://www.cerego.com/
- **Plattformen:** Web (B2B-Plattform).
- **USP:** Enterprise-Adaptive-Learning mit Versprechen „4-5× schnelleres Lernen, 90% Retention"; AI/ML-basierte Personalisierung. **Verkauft sich an Unternehmen, nicht Endkunden**.
- **Lizenz:** Proprietär.
- **Kosten:** Indiv. ab **$8.33/mo**, Enterprise ab 500 Seats individuell verhandelt (nicht öffentlich).
- **User loben:** Solide Lerneffekte in Enterprise-Trainings; gutes Reporting; sauberes UI.
- **User kritisieren:** Nicht für Selbstlerner gemacht; teuer für Einzelne; deck-Erstellungs-Workflow umständlich für Privatuser.
- **Firma & Geschichte:** US-Firma, in der Vergangenheit mehrfach pivotiert (B2C → B2B). Keine aktuelle Funding-Info.
- **Bedrohungsgrad: Sehr gering.** B2B, andere Welt.

Quellen: [Cerego](https://www.cerego.com/) · [Cerego G2](https://www.g2.com/products/cerego/reviews) · [Cerego Capterra 2026](https://www.capterra.com/p/169739/Cerego/)

---

### 3.16 NeuraCache

- **URL:** https://neuracache.com/
- **Plattformen:** iOS, Android.
- **USP:** SR-Karten **synchronisiert mit Notion / Obsidian / Logseq / Roam / Evernote / OneNote**, automatisches Extrahieren markierter Notizen → Karten. „Bridge"-Tool für PKM-Nutzer.
- **Lizenz:** Proprietär.
- **Kosten:** 14-Tage-Trial Pro. Pro-Subscription oder One-Time Lifetime; konkrete 2026-Preise nicht klar dokumentiert auf der öffentlichen Seite.
- **User loben:** Notion-/Obsidian-Sync ist die Killer-Funktion; spart Doppelarbeit für PKM-Power-User.
- **User kritisieren:** Klein, indie; UI weniger poliert als Mochi; Pricing intransparent; eher Mobile-only.
- **Firma & Geschichte:** Indie-Developer, geringe öffentliche Sichtbarkeit.
- **Bedrohungsgrad: Gering.** PKM-Nische; keine Überlappung mit unserer Generalist-Zielgruppe.

Quellen: [NeuraCache](https://neuracache.com/) · [NeuraCache App Store](https://apps.apple.com/us/app/neuracache-spaced-repetition/id1450923453) · [NeuraCache AlternativeTo](https://alternativeto.net/software/neuracache/about/)

---

## 4. Schluss-Empfehlung: 3 Differenzierungs-Hebel für Cards

### Hebel 1: **„Free Sync" konsequent ausspielen**

Niemand sonst bietet die Kombination, die wir liefern — _Markdown + FSRS + Multi-Device-Cloud-Sync inkl. Bilder/Audio + PWA + AI-Generierung_, alles im Free-Tier. Konkurrenten wollen für Sync Geld:

- Mochi: $5/mo
- AnkiMobile iOS: $25-30 einmalig
- Quizlet: Sync ja, aber Features paywallen
- RemNote: Pro-Limit (3 PDFs)
- Brainscape: $20/mo

**Action:** Marketing-Hauptbotschaft auf Pricing-Seite und Landingpage explizit machen: _„Sync gratis, immer. Karten gehören dir, lokal und in der Cloud."_ Gegen Mochi besonders direkt vergleichen. Wenn wir später monetarisieren, sollte Sync NIE in den Pro-Tier wandern — unser Reputations-Anker.

### Hebel 2: **Anki-Migration als First-Class-Feature, ohne Brand-Sniping**

Anki bleibt Power-User-Standard, aber Anki-User klagen über UX, FSRS-Tweaking und iOS-Preis. Sie sind die wertvollste Migrations-Zielgruppe (lange Lern-Historie, 100k+ Karten). Wir importieren bereits inkl. Bilder/Audio — das ist Gold.

**Action:**

- Eine dezidierte Landingpage `cards.mana.how/from-anki` mit ehrlichem Vergleich (was wir besser machen, was Anki noch besser kann), Migrationsanleitung, und expliziter Distanzierung von AnkiPro/AnkiApp/Noji.
- Eine ehrliche Story dazu („Wir sind nicht Anki. Wir sind Cards. Aber wir respektieren deine Anki-Karten."). Das positioniert uns als seriöse Alternative gegen die Brand-Sniper.
- Für Bonus-Punkte: Imports von Mochi-Decks und Quizlet-Sets ebenfalls anbieten — Knowt lebt davon, wir können das auch.

### Hebel 3: **„Local-First PWA" als Tech-Identität, nicht nur Implementierungsdetail**

Cards' Local-First + PWA-Architektur ist konzeptionell anders als Quizlet/Knowt (Web-First) und besser als Mochi auf iOS (App-Store-Friktion). Wir sind installierbar, offline-funktional, ohne App Store. Das schlägt mehrere Fliegen:

- Kein iOS-30%-Tax (vs AnkiMobile-Modell, das deshalb $25 kostet)
- Kein Vendor-Lock-in (Daten bleiben im Browser/lokal nutzbar)
- Kein Werbe-Modell nötig (vs Quizlet)
- Schnelles Auto-Update (vs Anki-Plugin-Brüche)

**Action:** Konsequent „Local-First PWA" in Tech-Marketing nutzen (HN, Reddit /r/Anki, /r/medicalschool, indie-hacker-Communities). Genau dort sitzen Quizlet-Wechsler und Anki-frustrierte Med-Studenten, die diesen technischen Pitch verstehen.

---

## Bonus: Was wir _nicht_ tun sollten

- **Nicht „Anki" im Namen führen** — siehe AnkiPro/AnkiApp Reputation. „Cards" ist neutral und reicht.
- **Nicht die SR-Algorithmus-Race spielen** — FSRS v6 reicht. SuperMemo SM-20 ist kein Marketing-Argument für 99% der User.
- **Nicht in Sprach-Lernen pivotieren** — Memrise und Duolingo besitzen das Feld, andere Mechaniken nötig.
- **Nicht alle AI-Features paywallen** — Knowt zeigt: ein großzügiges Free-Tier mit AI ist der Hebel gegen Quizlet.
- **Nicht Sync paywallen** — siehe Hebel 1. Das ist unser Anker-Wert.

---

## Methodische Hinweise

- Recherche durchgeführt 2026-05-07 via WebSearch (offizielle Pricing-Seiten, G2, Trustpilot, Capterra, Crunchbase, Wikipedia, Reddit, Anki-Forums, Hacker News).
- Einige Konkurrenten (NeuraCache, Quizgecko, Traverse, kleinere Indie-Tools) haben begrenzt öffentlich verfügbare Daten zu Funding/Team — wo Daten fehlen, ist „nicht öffentlich bekannt" eingetragen statt Spekulation.
- AnkiPro/Noji ist besonders intransparent (eigene Pricing-Seite versteckt klare Tier-Liste, Zahlen aus Reviews); wir sollten das im Auge behalten, wenn wir gegen sie konkurrieren.
- Quizlet-Bewertung mit „verwundbar" basiert real auf dem **Trustpilot-1.4/5** und der breiten Reddit-Stimmung — das ist eine echte Marktchance, kein Wunschdenken.
