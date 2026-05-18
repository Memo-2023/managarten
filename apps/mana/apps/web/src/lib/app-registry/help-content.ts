/**
 * Per-module help content — description, features, tips.
 *
 * Rendered inline in the shell body when the user clicks the help (?)
 * icon in the ModuleShell header. Keyed by appId.
 */

export interface ModuleHelp {
	description: string;
	features?: string[];
	tips?: string[];
}

export const MODULE_HELP: Record<string, ModuleHelp> = {
	todo: {
		description:
			'Aufgaben verwalten mit Projekten, Prioritäten und Fälligkeitsdaten. Alles lokal gespeichert und Ende-zu-Ende verschlüsselt.',
		features: [
			'Projekte & Labels zur Organisation',
			'Prioritäten (niedrig / mittel / hoch / dringend)',
			'Fälligkeitsdaten mit Kalender-Integration',
			'Board-Ansicht (Kanban) pro Projekt',
			'Subtasks innerhalb einer Aufgabe',
			'Drag & Drop: Aufgaben in Kalender oder Notizen ziehen',
			'AI-Tools: Aufgaben erstellen, abhaken, auflisten',
		],
		tips: [
			'Ziehe eine Aufgabe auf den Kalender um einen Zeitblock zu erstellen',
			'Im Chat kannst du sagen "erstelle eine Aufgabe: Einkaufen morgen"',
			'Klicke auf ein Projekt um nur dessen Aufgaben zu sehen',
		],
	},
	calendar: {
		description:
			'Termine und Zeitblöcke planen. Verknüpft sich mit Aufgaben, Habits und sozialen Events.',
		features: [
			'Tages-, Wochen- und Monatsansicht',
			'Wiederkehrende Termine',
			'Zeitblöcke für fokussiertes Arbeiten',
			'Verknüpfung mit Todo, Habits & Events',
			'AI-Tools: Termine erstellen, heutige Termine abfragen',
		],
		tips: [
			'Ziehe einen Kontakt auf den Kalender um ein Treffen zu planen',
			'Zeitblöcke verbinden Kalender, Aufgaben und Habits',
		],
	},
	contacts: {
		description:
			'Persönliches Adressbuch. Alle Felder (Name, Adresse, Telefon) sind verschlüsselt gespeichert.',
		features: [
			'Name, E-Mail, Telefon, Adresse, Social-Media',
			'Geburtstage',
			'Verknüpfung mit Events, Aufgaben & Notizen',
			'Drag & Drop in andere Module',
			'AI-Tools: Kontakte erstellen und durchsuchen',
		],
		tips: [
			'Ziehe einen Kontakt auf Todo um eine "Kontaktieren"-Aufgabe zu erstellen',
			'Kontakte tauchen als Verknüpfung in Events und Journal auf',
		],
	},
	habits: {
		description:
			'Gewohnheiten aufbauen und tracken. Tägliche Streaks, farbige Kategorien und Kalender-Integration.',
		features: [
			'Tägliches Logging per Tap',
			'Streak-Tracking mit Tageszielen',
			'Zeitblock-Verknüpfung im Kalender',
			'Farbige Kategorien',
			'Archivieren statt Löschen',
			'AI-Tools: Habits erstellen, loggen, Status abfragen',
		],
		tips: [
			'Habits erscheinen als Zeitblöcke im Kalender wenn du sie loggst',
			'Im Chat: "Logge Meditation für heute"',
		],
	},
	notes: {
		description:
			'Notizen mit Rich-Text-Editor. Titel und Inhalt sind verschlüsselt, Tags helfen bei der Organisation.',
		features: [
			'Rich-Text-Editor mit Markdown-Support',
			'Tags & Farbkodierung',
			'Anheften, Archivieren, Favorisieren',
			'Volltextsuche',
			'AI-Tools: Notizen erstellen, bearbeiten, taggen, durchsuchen',
		],
		tips: [
			'Ziehe eine Aufgabe auf Notizen um eine verknüpfte Notiz zu erstellen',
			'Im Chat: "Erstelle eine Notiz zu meinem Meeting"',
			'Farbige Notizen helfen bei der visuellen Organisation',
		],
	},
	journal: {
		description: 'Tagebuch für tägliche Reflexionen. Stimmung, freier Text — alles verschlüsselt.',
		features: [
			'Tägliche Einträge mit Stimmungswahl',
			'Anheften & Favorisieren',
			'Verschlüsselter Inhalt',
			'AI-Tool: Journal-Einträge erstellen',
		],
		tips: [
			'Im Chat: "Schreibe einen Journal-Eintrag über meinen Tag"',
			'Nutze Anheften für besonders wichtige Einträge',
		],
	},
	dreams: {
		description:
			'Traumtagebuch mit Symbolen, Stimmungen und AI-Interpretation. Finde Muster in deinen Träumen.',
		features: [
			'Traumdatum, Stimmung & Klarheitsgrad',
			'Luzides Träumen markieren',
			'Traumsymbole sammeln & zählen',
			'Tags & Volltextsuche',
			'AI-Interpretation (optional)',
		],
		tips: [
			'Schreibe Träume direkt nach dem Aufwachen auf — die Details verblassen schnell',
			'Wiederkehrende Symbole können auf Muster hinweisen',
		],
	},
	period: {
		description:
			'Zyklustracking mit Tagesprotokoll, Symptomen und Vorhersagen. Gesundheitsdaten sind besonders geschützt (DSGVO Art. 9).',
		features: [
			'Zykluslänge berechnen & nächsten Zyklus vorhersagen',
			'Tägliches Protokoll (Stärke, Stimmung, Symptome)',
			'Symptom-Kategorien mit Häufigkeiten über die Zeit',
			'Zyklen archivieren & vergleichen',
			'DSGVO Art. 9 — besonders verschlüsselt als Gesundheitsdaten',
		],
		tips: ['Je regelmäßiger du einträgst, desto genauer werden die Vorhersagen'],
	},
	finance: {
		description: 'Einnahmen & Ausgaben tracken. Kategorien, Budgets und Monatsübersicht.',
		features: [
			'Einnahmen & Ausgaben mit Betrag und Datum',
			'Eigene Kategorien erstellen',
			'Monatsbudgets pro Kategorie',
			'Typ-Filter (Einnahme/Ausgabe)',
			'AI-Tools: Transaktionen abfragen',
		],
		tips: [
			'Budgets zeigen dir wie viel du pro Kategorie noch übrig hast',
			'Beschreibung und Notizen sind verschlüsselt, Beträge bleiben für Statistiken im Klartext',
		],
	},
	places: {
		description:
			'Lieblingsorte, Restaurants, Cafés — speichern, kategorisieren und Besuche loggen.',
		features: [
			'Orte mit Adresse, Kategorie & Koordinaten',
			'Favoriten markieren',
			'Besuche loggen mit Zeitstempel',
			'Standort-Verlauf',
			'AI-Tools: Orte erstellen, besuchen, durchsuchen',
		],
		tips: [
			'Im Chat: "Speichere das Restaurant Sushi Samba als Favorit"',
			'Standort-Logs laufen im Hintergrund (wenn aktiviert)',
		],
	},
	chat: {
		description:
			'Unterhaltungen mit AI-Assistenten. Verschiedene Modelle, Systemkontexte und Vorlagen.',
		features: [
			'Mehrere parallele Konversationen',
			'System-Prompts & Vorlagen',
			'Verschlüsselte Nachrichten',
			'Modellauswahl',
		],
		tips: [
			'Der Chat hat Zugriff auf alle Modul-Tools — frage einfach was du brauchst',
			'Nutze Vorlagen für wiederkehrende Aufgaben',
		],
	},
	context: {
		description:
			'Strukturiertes Profil — Interessen, Tagesablauf, Ziele, Ernährung. Hilft der AI dich besser zu verstehen.',
		features: [
			'Geführtes Interview mit Fragen',
			'Strukturierte Sektionen (Über mich, Interessen, Routine, ...)',
			'Freitext-Ergänzung für alles andere',
			'Wird automatisch als AI-Kontext genutzt',
		],
		tips: [
			'Du musst nicht alles ausfüllen — jedes Detail hilft der AI',
			'Das Interview kann jederzeit fortgesetzt werden',
		],
	},
	times: {
		description: 'Zeiterfassung — tracke wie viel Zeit du womit verbringst.',
		features: [
			'Start/Stop Timer',
			'Manuelle Zeiteinträge',
			'Projekt-Zuordnung',
			'Tages- und Wochenübersicht',
		],
		tips: ['Zeiteinträge erscheinen als Zeitblöcke im Kalender'],
	},
	quotes: {
		description:
			'Zitate sammeln, entdecken und wiederfinden. Eigene und aus einer kuratierten Datenbank.',
		features: [
			'Eigene Zitate mit Autor & Quelle erstellen',
			'Kuratierte Zitat-Datenbank zum Stöbern',
			'Kategorien & Zuordnung',
			'Verschlüsselte Inhalte',
		],
		tips: ['Speichere Zitate aus Büchern, Podcasts oder Gesprächen — sie gehen sonst verloren'],
	},
	cards: {
		description: 'Karteikarten zum Lernen. Decks erstellen, Karten durchgehen und Wissen festigen.',
		features: [
			'Decks mit beliebig vielen Karten',
			'Vorderseite / Rückseite',
			'Lernmodus mit Selbstbewertung',
			'Verschlüsselter Inhalt',
		],
		tips: ['Nutze kurze, präzise Fragen auf der Vorderseite für besseren Lerneffekt'],
	},
	picture: {
		description: 'AI-Bildgenerierung — erstelle Bilder mit Textprompts auf deinem GPU-Server.',
		features: [
			'Text-zu-Bild Generierung',
			'Prompt & Negativ-Prompt',
			'Bildgalerie mit Verlauf',
			'Verschiedene Modelle & Stile',
		],
		tips: ['Detaillierte Prompts mit Stil-Angaben liefern bessere Ergebnisse'],
	},
	music: {
		description:
			'Musik-Sammlung und Playlists verwalten. Titel und Metadaten sind verschlüsselt gespeichert.',
		features: [
			'Songs mit Titel, Interpret & Metadaten',
			'Playlists erstellen und sortieren',
			'Verschlüsselte Titel & Beschreibungen',
			'Durchsuchen und Filtern',
		],
		tips: ['Nutze Playlists um Musik nach Stimmung oder Anlass zu sortieren'],
	},
	photos: {
		description:
			'Fotoalben organisieren und durchsuchen. Bilder werden im persönlichen Cloud-Speicher abgelegt.',
		features: [
			'Alben erstellen und benennen',
			'Fotos hochladen & organisieren',
			'Bildvorschau & Vollbild-Ansicht',
			'Gespeichert in deinem privaten MinIO-Speicher',
		],
		tips: ['Fotos werden in deinem persönlichen Speicher abgelegt — nicht bei Drittanbietern'],
	},
	storage: {
		description:
			'Persönlicher Cloud-Speicher — Dateien sicher ablegen, in Ordnern organisieren und per Link teilen.',
		features: [
			'Ordnerstruktur mit Verschachtelung',
			'Drag & Drop Upload',
			'Verschlüsselte Dateinamen',
			'Teilen per Link',
			'Gespeichert auf deinem eigenen Server (MinIO)',
		],
		tips: [
			'Dateien liegen auf deinem eigenen Server — kein Drittanbieter-Cloud',
			'Dateinamen sind verschlüsselt, auch im Speicher nicht im Klartext sichtbar',
		],
	},
	presi: {
		description:
			'Präsentationen mit Folien erstellen. Markdown-basierter Inhalt, verschlüsselt gespeichert.',
		features: [
			'Folien mit Rich-Content erstellen',
			'Markdown-Editor pro Folie',
			'Reihenfolge per Drag & Drop ändern',
			'Verschlüsselter Inhalt (Titel & Folien-Text)',
			'Mehrere Decks verwalten',
		],
		tips: ['Nutze Markdown für schnelle Formatierung: **fett**, *kursiv*, Listen'],
	},
	inventory: {
		description:
			'Sammlungen verwalten — inventarisiere Besitz mit eigenen Feldern, Kategorien und Standorten.',
		features: [
			'Eigene Sammlungen mit Schema-Builder (Felder definieren)',
			'Standorte & Kategorien hierarchisch',
			'Kaufdaten, Fotos & Notizen',
			'Status: besitzt / verliehen / eingelagert / zu verkaufen',
		],
		tips: [
			'Nutze den Schema-Builder um eigene Felder pro Sammlung zu definieren',
			'Standorte können verschachtelt sein (Zuhause → Büro → Schreibtisch)',
		],
	},
	questions: {
		description:
			'Fragen sammeln und Antworten festhalten — ein persönliches Q&A-Archiv für Dinge die du herausfinden möchtest.',
		features: [
			'Fragen mit Beschreibung & Kontext',
			'Mehrere Antworten pro Frage sammeln',
			'Verschlüsselter Inhalt',
			'Durchsuchen und Filtern',
		],
		tips: ['Nutze Questions als persönliches Recherche-Archiv: Frage notieren, Antworten ergänzen'],
	},
	skilltree: {
		description:
			'Fähigkeiten visualisieren und Lernfortschritt tracken. Behalte den Überblick über dein Können.',
		features: [
			'Skill-Kategorien definieren (z.B. Sprachen, Technik, Kreativ)',
			'Fortschritt pro Fähigkeit tracken',
			'Fortschritts-Übersicht',
			'Verschlüsselte Inhalte',
		],
		tips: ['Definiere Kategorien nach Lebensbereichen für eine gute Übersicht'],
	},
	calc: {
		description:
			'Taschenrechner mit Berechnungsverlauf. Ergebnisse bleiben gespeichert und sind jederzeit abrufbar.',
		features: [
			'Grundrechenarten & erweiterte Funktionen',
			'Verlauf aller vergangenen Berechnungen',
			'Ergebnisse kopieren & wiederverwenden',
			'Kompakte Ansicht in der Workbench',
		],
	},
	guides: {
		description:
			'Schritt-für-Schritt Anleitungen erstellen und durcharbeiten. Fortschritt wird pro Durchlauf gespeichert.',
		features: [
			'Sektionen mit einzelnen Schritten',
			'Checklisten-Modus zum Abhaken',
			'Fortschritt pro Durchlauf gespeichert',
			'Schwierigkeitsgrade & Kategorien',
			'Geschätzte Dauer pro Guide',
		],
		tips: [
			'Nutze Guides für Onboarding-Prozesse, Checklisten oder wiederkehrende Abläufe',
			'Mehrere Durchläufe zeigen deinen Fortschritt über die Zeit',
		],
	},
	body: {
		description:
			'Fitness-Tracking — Übungen, Workouts, Körpermaße und Trainings-Phasen. Gesundheitsdaten sind besonders geschützt.',
		features: [
			'Übungsbibliothek nach Muskelgruppe & Equipment',
			'Routinen zusammenstellen',
			'Workout-Logging: Sets, Reps, Gewicht',
			'Körpermaße mit Trend-Charts',
			'Tägliche Check-ins (Energie, Schlaf, Muskelkater)',
			'Trainings-Phasen (Aufbau / Diät / Erhaltung)',
			'DSGVO Art. 9 — besonders verschlüsselt',
		],
		tips: [
			'Starte ein Workout von einer Routine aus — die Übungen werden vorgeladen',
			'Körpermaße-Charts zeigen den Trend über Wochen und Monate',
		],
	},
	events: {
		description: 'Soziale Events planen — Gästeliste, RSVP, Bring-Liste und teilbare Einladungen.',
		features: [
			'Gäste einladen (aus Kontakten oder manuell)',
			'RSVP-Status pro Gast',
			'Bring-Liste: wer bringt was?',
			'Teilbare Einladungs-Links',
			'Zeitblock-Integration im Kalender',
		],
		tips: [
			'Teile den Einladungslink — Gäste können ohne Account zusagen',
			'Bring-Listen-Items können von Gästen "reserviert" werden',
		],
	},
	firsts: {
		description:
			'Erste Male festhalten — eine Bucket-List für Dinge die du erleben möchtest, und ein Archiv erlebter Momente.',
		features: [
			'Träume (Bucket List) & erlebte Firsts',
			'Kategorien: Kulinarisch, Abenteuer, Reise, Kreativ, ...',
			'Priorität & Erwartung vs. Realität',
			'Teilen: wer war dabei?',
		],
		tips: ['Nutze "Erwartung vs. Realität" um festzuhalten wie das Erlebnis wirklich war'],
	},
	drink: {
		description:
			'Trink-Tracker mit Tageszielen und schnellen Presets. Behalte deine Hydration im Blick.',
		features: [
			'Quick-Tap Presets (Wasser, Kaffee, Tee, ...)',
			'Tägliches ml-Ziel mit Fortschrittsbalken',
			'Verschiedene Getränketypen mit eigenen Icons',
			'Eigene Presets erstellen',
			'AI-Tools: Einträge loggen, Fortschritt abfragen, rückgängig machen',
		],
		tips: [
			'Im Chat: "Logge ein Glas Wasser" oder "Wie viel habe ich heute getrunken?"',
			'Erstelle Presets für deine häufigsten Getränke mit der richtigen ml-Menge',
		],
	},
	recipes: {
		description:
			'Rezepte sammeln und organisieren — Zutaten, Zubereitungsschritte, Schwierigkeit und Portionsgrößen.',
		features: [
			'Zutaten-Liste mit Mengenangaben',
			'Zubereitungsschritte einzeln dokumentieren',
			'Schwierigkeit & geschätzter Zeitaufwand',
			'Tags & Favoriten zum schnellen Wiederfinden',
			'Verschlüsselte Inhalte',
		],
		tips: [
			'Nutze Tags wie "schnell", "vegetarisch", "Gäste" zum Filtern',
			'Favorisiere deine Lieblingsrezepte für schnellen Zugriff',
		],
	},
	stretch: {
		description: 'Stretching-Routinen mit Übungsbibliothek, Timer und Beweglichkeitstests.',
		features: [
			'Übungen nach Körperregion & Schwierigkeit',
			'Routinen mit Timer zusammenstellen',
			'Beweglichkeits-Assessments (Tests + Schmerzregionen)',
			'Session-Verlauf mit Dauer',
			'Erinnerungen konfigurieren',
		],
		tips: [
			'Starte mit dem Assessment um deinen Ist-Zustand festzuhalten',
			'Regelmäßige Sessions von 10-15 Min sind effektiver als seltene lange',
		],
	},
	mail: {
		description:
			'E-Mail-Entwürfe lokal verfassen und verschlüsselt speichern. Sende sie später über deinen E-Mail-Server.',
		features: [
			'Entwürfe mit Empfänger, CC, Betreff & Text',
			'HTML-Body Support für formatierte Mails',
			'Antworten auf bestehende Nachrichten vorbereiten',
			'Verschlüsselter Inhalt (Empfänger, Betreff, Text)',
		],
		tips: [
			'Entwürfe werden lokal gespeichert — du brauchst keine Internetverbindung zum Schreiben',
		],
	},
	meditate: {
		description:
			'Meditation, Atemübungen und Body Scans. Timer mit Presets und Reflexions-Notizen.',
		features: [
			'Geführte Presets: Atemübungen, Body Scan, freie Meditation',
			'Frei wählbare Dauer',
			'Stimmung vorher / nachher',
			'Session-Verlauf mit Statistiken',
			'Eigene Presets erstellen',
		],
		tips: [
			'Starte mit kurzen Sessions (5 Min) und steigere langsam',
			'Die Stimmungs-Bewertung hilft, den Effekt über die Zeit zu sehen',
		],
	},
	mood: {
		description:
			'Stimmung mehrmals täglich tracken — Emotionen, Intensität, Kontext und Begleitpersonen.',
		features: [
			'Emotionen mit Intensitätsstufe',
			'Aktivität & Begleitpersonen',
			'Freitext-Notizen',
			'Tagesverlauf-Ansicht',
		],
		tips: ['Regelmäßiges Tracken zeigt Muster — z.B. welche Aktivitäten deine Stimmung heben'],
	},
	sleep: {
		description:
			'Schlaf tracken — Qualität, Dauer, Unterbrechungen und eine Schlafhygiene-Checkliste.',
		features: [
			'Schlaf- und Aufwachzeit',
			'Qualitätsbewertung',
			'Unterbrechungen erfassen',
			'Schlafhygiene-Checkliste (eigene Punkte)',
			'DSGVO Art. 9 — besonders verschlüsselt',
		],
		tips: ['Die Hygiene-Checkliste hilft, gute Schlafgewohnheiten zu entwickeln'],
	},
	wishes: {
		description:
			'Wunschliste mit Preiszielen, Produkt-Links und Listen. Organisiere Wünsche nach Anlass.',
		features: [
			'Wünsche mit Zielpreis & Kategorie',
			'Listen erstellen (Geburtstag, Weihnachten, Für mich, ...)',
			'Produkt-URLs pro Wunsch hinterlegen',
			'Preisverlauf-Tracking',
			'Prioritäten & Status (offen / erfüllt / archiviert)',
			'AI-Tools: Wünsche erstellen, auflisten, als erfüllt markieren',
		],
		tips: [
			'Erstelle Listen für verschiedene Anlässe — so behältst du den Überblick',
			'Im Chat: "Setze Sony WH-1000XM5 auf meine Wunschliste, Zielpreis 250€"',
		],
	},
	wetter: {
		description:
			'Wetter für deine Standorte mit detaillierter Vorhersage und Vergleich verschiedener Wettermodelle.',
		features: [
			'Mehrere Standorte speichern & wechseln',
			'Verschiedene Wettermodelle vergleichen (DWD, ECMWF, GFS, ...)',
			'Stunden- und Tagesvorhersage',
			'Temperatur, Wind, Niederschlag & mehr',
			'Standard-Standort festlegen',
		],
		tips: [
			'Vergleiche verschiedene Modelle — bei unsicherem Wetter weichen sie voneinander ab',
			'Lege deinen Heimatort als Standard fest',
		],
	},
	writing: {
		description:
			'KI-Ghostwriter für intentional produzierten Prosa-Text. Brief Thema, Stil und Quellen — ein fertiger Entwurf entsteht, den du iterativ verfeinerst.',
		features: [
			'12 Textarten: Blog, Essay, E-Mail, Social, Story, Brief, Rede, Bewerbung, Pressetext, Bio, …',
			'9 eingebaute Schreibstile (Akademisch, Casual Blog, LinkedIn, Hemingway, Memoir, …) plus eigene Stile',
			'Quellen verknüpfen aus 7 Modulen: Artikel, Notiz, Library, Kontext, Ziel, Bild, URL',
			'Selection-Verfeinerung: Markiere Text → Kürzen / Erweitern / Ton ändern / Umschreiben / Übersetzen',
			'Versionierung mit "Als Checkpoint speichern" + Wiederherstellen',
			'Visibility: privat / Space / Unlisted-Link / öffentlich',
			'Export: Markdown, PDF, "Als Artikel speichern"',
			'Persona-Linkage: Agents pinnen einen Default-Stil',
			'Token-Cost pro Generation in der Versionshistorie',
		],
		tips: [
			'⌘G generiert · ⌘⇧S speichert Checkpoint · ⌘Z macht letzte Verfeinerung rückgängig',
			'Klicke ✨ neben dem Titel-Feld — die KI schlägt einen Titel aus deinem Briefing vor',
			'In der BriefingForm: "Quellen" → 7 Buttons. Nutze "Kontext" um den Space-Kontext-Doc anzuhängen.',
			'Drafts sind ziehbar — auf andere Module droppen, sobald deren Drop-Targets ausgebaut sind',
			'Eigene Stile unter "🎨 Stile" anlegen — die Beschreibung wird wörtlich an die KI übergeben',
		],
	},
	library: {
		description:
			'Medien-Log — Bücher, Filme, Serien und Comics tracken. Status, Fortschritt, Bewertung.',
		features: [
			'Bücher, Filme, Serien, Comics in einer Ansicht',
			'Status: läuft / fertig / geplant / abgebrochen',
			'Fortschritt tracken (Seiten, Episoden, Ausgaben)',
			'Bewertung & Review-Text',
			'Favoriten & Jahresrückblick',
		],
		tips: [
			'Nutze "Geplant" als Merkliste für Empfehlungen',
			'Der Jahresrückblick zeigt was du im laufenden Jahr geschafft hast',
		],
	},
	'news-research': {
		description:
			'RSS-Feeds durchsuchen und Artikel für die News-App entdecken. Kann als Recherche-Tool in AI-Missionen eingebunden werden.',
		features: [
			'RSS-Feeds nach Thema oder URL suchen',
			'Feed-Ergebnisse mit Titel, Datum & Vorschau',
			'Artikel in die News-App speichern',
			'AI-Missions nutzen News Research automatisch für Recherche-Aufträge',
		],
		tips: [
			'Erstelle eine AI-Mission mit "recherchiere" im Ziel — sie nutzt dann automatisch RSS-Feeds',
		],
	},
	myday: {
		description:
			'Tagesübersicht — alles Wichtige auf einen Blick: Termine, Aufgaben, Habits und Stimmung.',
		features: [
			'Heutige Termine & Aufgaben',
			'Habit-Fortschritt des Tages',
			'Schnellzugriff auf häufige Aktionen',
			'AI-Zusammenfassung des Tages',
		],
		tips: ['Nutze MyDay als Startseite um morgens den Überblick zu bekommen'],
	},
	'ai-missions': {
		description:
			'Langlebige AI-Aufträge — definiere ein Ziel, verknüpfe Inputs, und lass den Agenten autonom arbeiten.',
		features: [
			'Ziel und Kontext definieren',
			'Inputs aus anderen Modulen verknüpfen (Notizen, Aufgaben, ...)',
			'Einmalig oder wiederkehrend (täglich, wöchentlich, ...)',
			'Vorschläge prüfen und freigeben',
			'Debug-Log mit vollem Prompt-Verlauf pro Iteration',
			'Server-seitige Ausführung über mana-ai',
		],
		tips: [
			'Starte mit einfachen Missionen: "Erstelle jeden Morgen 3 Aufgaben basierend auf meinen Zielen"',
			'Verknüpfe dein Kontext-Dokument als Input für bessere Ergebnisse',
			'Der Debug-Log hilft zu verstehen warum die AI bestimmte Entscheidungen trifft',
		],
	},
	agents: {
		description:
			'Benannte AI-Personas mit eigenem System-Prompt, Policy und Gedächtnis. Jeder Agent kann eigene Missionen ausführen.',
		features: [
			'Eigene Agents mit Name, Rolle & Avatar',
			'System-Prompt pro Agent',
			'Policy pro Tool (automatisch / vorschlagen / verbieten)',
			'Agent-Gedächtnis (persistiert über Sessions)',
			'Vorlagen: Recherche-Agent, Kontext-Agent, Today-Agent',
		],
		tips: [
			'Der Standard-Agent "Mana" ist für allgemeine Aufgaben gedacht',
			'Erstelle spezialisierte Agents: z.B. einen "Fitness-Coach" mit entsprechendem Prompt',
			'Die Policy bestimmt ob der Agent eigenständig handelt oder erst fragt',
		],
	},
	'ai-workbench': {
		description:
			'Timeline aller AI-Aktionen. Filtere nach Agent, Modul oder Mission — und mache Aktionen rückgängig.',
		features: [
			'Chronologische Event-Timeline',
			'Filter: nach Agent, Modul, Mission',
			'Iterationen einzeln rückgängig machen',
			'Datenzugriff-Audit (welche Daten hat die AI gelesen?)',
		],
		tips: [
			'Nutze den Revert-Button um eine ganze AI-Iteration rückgängig zu machen',
			'Der Datenzugriff-Tab zeigt genau welche verschlüsselten Daten entschlüsselt wurden',
		],
	},
	goals: {
		description:
			'Ziele setzen und Fortschritt verfolgen. Verknüpft sich mit AI-Missionen und dem Kontext-Profil.',
		features: [
			'Ziele mit Status definieren (offen / in Arbeit / erreicht)',
			'Modulübergreifende Verknüpfung mit Aufgaben & Habits',
			'AI-Tools: Ziele abfragen und in Missionen referenzieren',
			'Ziele als Input für AI-Missionen nutzen',
		],
		tips: [
			'Verknüpfe Ziele mit AI-Missionen — der Agent kann dann Aufgaben daraus ableiten',
			'Formuliere Ziele konkret und messbar für bessere AI-Unterstützung',
		],
	},
	playground: {
		description:
			'LLM-Spielwiese — verschiedene Modelle und System-Prompts ausprobieren. Perfekt zum Experimentieren.',
		features: [
			'Freie Konversationen',
			'System-Prompt-Snippets speichern & wiederverwenden',
			'Modellauswahl (verschiedene AI-Modelle)',
			'Verschlüsselter Verlauf',
		],
	},
	quiz: {
		description:
			'Eigene Quizze bauen und spielen. Single-Choice, Multiple-Choice, Wahr/Falsch oder Freitext.',
		features: [
			'Verschiedene Fragetypen',
			'Erklärungen pro Frage',
			'Spiel-Versuche mit Score & Verlauf',
			'Verschlüsselte Fragen & Antworten',
		],
		tips: ['Nutze Erklärungen um den Lerneffekt zu maximieren'],
	},
	automations: {
		description:
			'Wenn-Dann Regeln zwischen Modulen — automatisiere wiederkehrende Abläufe ohne Code.',
		features: [
			'Trigger aus einem Modul wählen (z.B. neue Aufgabe erstellt)',
			'Aktion in einem anderen Modul definieren (z.B. Notiz erstellen)',
			'Aktivieren / Deaktivieren per Toggle',
			'Quell- und Ziel-Modul frei kombinieren',
		],
		tips: [
			'Starte einfach: z.B. "Wenn ein neuer Kontakt erstellt wird, erstelle eine Aufgabe zum Kennenlernen"',
		],
	},
	activity: {
		description:
			'Live-Stream aller Events aus allen Modulen — Aufgaben erledigt, Termine erstellt, Gewohnheiten geloggt, Getränke getrunken. Zeigt, was gerade in deinem System passiert.',
		features: [
			'Chronologische Ansicht aller Domain-Events',
			'Filtert pro Modul (Todo, Kalender, Trinken, Essen, …)',
			'Zeigt Actor: User, AI-Agent oder System-Source',
			'Verlinkt direkt zum ursprünglichen Eintrag',
		],
		tips: [
			'Nützlich, um zu sehen was die AI-Agents im Hintergrund tun',
			'Events sind unveränderlich — das ist dein Audit-Log',
		],
	},
	admin: {
		description:
			'Interne Admin-Tools für Benutzer-, Tier- und System-Verwaltung. Nur für Accounts mit role=admin sichtbar.',
		features: [
			'User-Liste mit Such- und Tier-Edit',
			'Per-User Daten-Übersicht (GDPR)',
			'Access-Tier-Management (guest/public/beta/alpha/founder)',
			'User-Daten löschen (Right to be forgotten)',
		],
	},
	'ai-health': {
		description:
			'Status der AI-Infrastruktur: Ollama-Erreichbarkeit, Cloud-Provider-Keys, Mission-Runner-Gesundheit.',
		features: [
			'Ping-Status für mana-llm und Ollama',
			'Key-Check für OpenAI/Anthropic/Google (wenn konfiguriert)',
			'Mission-Runner-Status (läuft der Background-Tick?)',
			'Letzte LLM-Calls mit Latenz + Fehlerrate',
		],
		tips: [
			'Rot? → Service neu starten oder Key prüfen',
			'Gelb? → Provider ist erreichbar aber langsam',
		],
	},
	'ai-insights': {
		description:
			'AI-generierte Einsichten über deine Daten — Patterns, Trends, ungenutzte Verbindungen, Impulse. Datenschutz: alles läuft lokal oder mit deinen Keys.',
		features: [
			'Automatische Wochen-/Monats-Rückblicke',
			'Cross-Module-Patterns (z.B. "du schläfst schlechter an Tagen mit vielen Meetings")',
			'Vorschläge für neue Missionen oder Rituale',
			'Bearbeitbare Einsichten — du kannst Falschaussagen korrigieren',
		],
		tips: ['Je mehr Module aktiv genutzt werden, desto aussagekräftiger werden die Einsichten'],
	},
	'ai-policy': {
		description:
			'Editor für AI-Tool-Policies pro Agent: Was darf die AI automatisch, was muss sie vorschlagen, was ist verboten.',
		features: [
			'Per-Tool: auto | propose | deny',
			'Pro-Agent-Konfiguration (Mana, Recherche-Agent, Kontext-Agent, …)',
			'Defaults aus @mana/shared-ai AI_PROPOSABLE_TOOL_NAMES',
			'Export/Import von Policy-Profilen',
		],
		tips: [
			'"auto" für lesende Tools (list_notes, get_tasks_stats, …)',
			'"propose" für schreibende Tools — so bleibt das Proposal-Inbox die Single Source of Truth',
			'"deny" wenn du einem Agent die Mutation komplett verbieten willst',
		],
	},
	'api-keys': {
		description:
			'Persönliche API-Keys für externen Zugriff auf deine Mana-Daten. Jeder Key hat einen Scope-Satz und ein Rate-Limit.',
		features: [
			'Key mit beliebigem Namen erstellen',
			'Scopes pro Key (z.B. read:tasks, write:notes)',
			'Rate-Limit pro Stunde konfigurierbar',
			'Secret wird genau einmal angezeigt — danach nur Prefix',
			'Widerruf jederzeit möglich',
		],
		tips: [
			'Nach Erstellung sofort kopieren — der Secret ist später nicht mehr sichtbar',
			'Scopes knapp halten: lieber mehrere Keys mit minimalen Rechten als einen Universal-Key',
		],
	},
	companion: {
		description:
			'Dein AI-Companion — der Chat-Zugang zu Mana. Stellt Fragen über deine Daten, erstellt Aufgaben/Notizen per Freitext, führt Research-Missions aus.',
		features: [
			'Chat mit vollem Kontext über alle deine Module',
			'Tool-Use: Der Companion schlägt Änderungen vor (Todo, Kalender, Notizen, …) — du bestätigst',
			'Missions: Longrunning-Aufgaben mit Wiederholung und Budget',
			'Scene-Lens: binde Szenen an einen spezifischen Agent',
		],
		tips: [
			'Ziehe ein Modul in den Chat um es als Kontext zu übergeben',
			'"Plane meine Woche" — nutzt Kalender + Todo + Habits zusammen',
			'Für tiefe Recherche: `research_news` Tool mit `depth: "deep"`',
		],
	},
	complexity: {
		description:
			'Treemap der Codebase — Fläche = Lines of Code, Farbe = git churn. Dev-Tool, nur für Admin-Accounts sichtbar.',
		features: [
			'Interaktive Treemap (zoomen, filtern)',
			'Hotspot-Erkennung: hohe Churn + hohe LOC = Refactor-Kandidat',
			'Per-Modul-Breakdown',
			'Generiert via `pnpm audit:map`',
		],
		tips: ['Zum Updaten der Daten: `pnpm audit:map` im Monorepo laufen lassen'],
	},
	credits: {
		description:
			'Credits-Konto und Abo-Verwaltung. Mana-Credits bezahlen AI-Anfragen, Sync, Premium-Research. 1 Credit ≈ 1 Cent.',
		features: [
			'Aktuelles Guthaben + Gesamt verdient/ausgegeben',
			'Transaktions-Historie (Purchase, Usage, Refund, Gift)',
			'Credit-Pakete kaufen (Stripe)',
			'Cloud-Sync abonnieren/verwalten',
			'Geschenk-Codes einlösen',
		],
		tips: [
			'Niedrige Credits? → Sync pausiert, lokale Daten bleiben erhalten',
			'Geschenk-Codes laufen automatisch ab, wenn nicht eingelöst',
		],
	},
	feedback: {
		description:
			'Schnelles Feedback an das Mana-Team. Bug melden, Feature wünschen, allgemein Dampf ablassen — alles mit einem Klick.',
		features: [
			'Kategorie: Bug / Feature / Anderes',
			'Optional Screenshot + Kontext-Metadaten anhängen',
			'Sendet an die Mana-Feedback-Inbox',
			'Status-Updates per E-Mail wenn gewünscht',
		],
	},
	help: {
		description:
			'Zentrale Hilfe-Seite mit FAQ, Anleitungen und Support-Infos. Erklärt übergreifende Konzepte wie Lokal-First, Verschlüsselung, Sync und Tiers.',
		features: [
			'FAQ zu den häufigsten Fragen',
			'Getting-Started-Guides',
			'Konzepte: Scenes, Module, AI-Workbench, Rituals',
			'Support-Kontakt',
		],
		tips: ['Jedes Modul hat zusätzlich sein eigenes ?-Icon mit kontextueller Hilfe'],
	},
	profile: {
		description:
			'Dein persönliches Profil — der Kontext-Doc, den alle AI-Agents als Basis nutzen. Wer bist du, was willst du, was sollte Mana über dich wissen.',
		features: [
			'Kontext-Doc (Markdown, verschlüsselt)',
			'Interview-Modus: Mana fragt dich Schritt für Schritt',
			'Voice-Interview (TTS) für entspanntes Durchsprechen',
			'Wird in jede Mission auto-injiziert',
		],
		tips: [
			'Kurz + konkret: Namen, Rollen, Ziele, Vorlieben, No-Gos',
			'Updaten wenn sich Kontext ändert — z.B. neuer Job, neues Projekt',
		],
	},
	rituals: {
		description:
			'Tägliche oder wöchentliche Rituale als geführte Zeremonien. Morgendroutine, Abend-Reflexion, Wochen-Rückblick — Schritt für Schritt.',
		features: [
			'Zeremonie-Steps: Prompt-Frage, Notiz, Habit, Tag-Edit, Atemübung',
			'Zeitplan: täglich/wöchentlich/manuell',
			'Verknüpfung mit Habits, Notizen, Goals',
			'Verschlüsselte Antworten',
		],
		tips: [
			'Starte klein: 2–3 Steps, 2 Minuten',
			'Der Wochen-Rückblick profitiert stark von AI-Insights als ersten Step',
		],
	},
	settings: {
		description:
			'Zentrale App-Einstellungen. Allgemein, KI, Sicherheit (Vault/ZK-Mode), Daten, Sync.',
		features: [
			'Allgemein: Sprache, Zeitzone, Datumsformat',
			'KI-Optionen: welche LLM-Schichten (lokal, Cloud, alle) darf Mana nutzen',
			'Sicherheit: Vault-Status, Recovery-Code, Zero-Knowledge-Mode',
			'Daten: Export als JSON, kompletter Daten-Löschung (GDPR)',
			'Sync: Cloud-Sync aktivieren/deaktivieren, Intervall ändern',
		],
		tips: [
			'Zero-Knowledge-Mode: nur du kannst deine Daten entschlüsseln — Recovery-Code gut aufbewahren',
			'KI-Einstellungen können pro Agent überschrieben werden',
		],
	},
	spiral: {
		description:
			'Mana Spiral — visueller Fingerabdruck deiner Aktivität als farbiger Pixel-Spiral-Plot. Zeigt auf einen Blick, wie dein System-Rhythmus aussieht.',
		features: [
			'Pixel pro Tag pro Modul',
			'Farben codieren Modul-Art (Aufgaben, Habits, Notizen, Essen, …)',
			'Monats- oder Jahresansicht',
			'Klick auf Pixel → Details des Tags',
		],
		tips: ['Lücken zeigen Pausen — gut oder schlecht je nach Kontext'],
	},
	themes: {
		description:
			'Theme-Picker für das Erscheinungsbild der App. Light, Dark, Auto + farbliche Akzent-Varianten.',
		features: [
			'Light / Dark / System-Auto',
			'Akzentfarben (Lume Gold Default)',
			'Kontrast-Varianten für Accessibility',
			'Theme-Preview bevor du umschaltest',
		],
		tips: ['System-Auto folgt deinem OS-Dark-Mode automatisch zur richtigen Uhrzeit'],
	},
	'research-lab': {
		description:
			'Web-Research-Anbieter Seite-an-Seite vergleichen: gleiche Query an bis zu fünf Provider parallel, Antworten + Latenz + Kosten nebeneinander. Alle Runs werden serverseitig persistiert für spätere Auswertung.',
		features: [
			'Drei Modi: Suche (6 Provider wie Brave, Tavily, Exa, Serper, SearXNG, DuckDuckGo)',
			'Extrakt (Firecrawl, Jina Reader, Readability) — eine URL, drei Extraktoren',
			'Agent (Perplexity Sonar, Claude web_search, OpenAI Responses, Gemini Grounding)',
			'Auto-Router: ohne Provider-Auswahl klassifiziert ein Regex-/LLM-Mix die Query und wählt den besten Anbieter',
			'1–5 Sterne pro Ergebnis bewerten — deine Ratings persistieren zur späteren Auswertung',
			'BYO-Keys: eigene API-Keys hinterlegen, deine Calls gehen direkt ohne Credits-Verbrauch',
			'Runs-Historie klickbar mit Detail-View für jeden vergangenen Vergleich',
		],
		tips: [
			'Lass den Provider leer → Auto-Router wählt je nach Query-Typ (News → Tavily, Paper → Exa, allgemein → Brave)',
			'"Suche" für Links + Snippets, "Extrakt" für Volltext einer URL, "Agent" für synthetisierte Antwort mit Zitaten',
			'Cmd/Ctrl+Enter startet den Vergleich ohne Klick',
			'Eigene API-Keys unter "🔑 API-Keys" — überschreiben den Server-Key und kosten dich keine Credits',
		],
	},
	articles: {
		description:
			'Pocket-Style Read-it-Later — speichere Web-Artikel zum späteren Lesen. URLs werden serverseitig per Readability extrahiert, landen verschlüsselt in deiner IndexedDB und sind danach offline lesbar im Reader-View. Mit Highlights, Tags und Reading-Progress.',
		features: [
			'URL einfügen → Server extrahiert via Readability → verschlüsselt gespeichert',
			'Reader-View mit Serif/Sans-Auswahl, Light/Sepia/Dark, Schriftgröße',
			'Highlights mit 4 Farben + optionalen Notizen pro Selektion',
			'Tags aus dem globalen Tag-Pool',
			'Reading-Progress wird automatisch beim Scrollen gespeichert',
			'Bookmarklet (URL + HTML-Variante für Cookie-gewallte Seiten)',
			'Share-Target auf Android/Chromium PWA',
			'Bulk-Import: Mehrere URLs auf einmal über /articles/import — Server arbeitet im Hintergrund, Tab-Close-resistent, Multi-Device-sichtbar',
			'AI-Tools: Artikel speichern, archivieren, taggen, Highlight setzen, Bulk-Import starten',
		],
		tips: [
			'Cookie-Wand erkannt? → /articles/settings → "Browser-HTML-Bookmarklet" benutzt deine bestehende Browser-Session',
			'Mehrere URLs gleichzeitig? → /articles/import — eine pro Zeile oder durch Komma getrennt, max 200 pro Job',
			'Im Bulk-Import-Detail zeigt jede Cookie-Wand-Zeile einen "Erneut speichern"-Link der direkt zum Bookmarklet-Flow springt',
			'Teaser stellt sich raus dass der Server nur den Cookie-Banner extrahiert hat? → einfach mit dem HTML-Bookmarklet überschreiben — die Article-ID bleibt',
		],
	},
};
