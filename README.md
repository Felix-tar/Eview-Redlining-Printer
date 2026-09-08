# eVIEW Redlining Print Assistant

Browser extension for Microsoft Edge and Google Chrome that helps users find eVIEW pages containing redlining annotations, collect the matching pages, and print them together in a clean A4 landscape layout.

> Independent community project. Not an official EPLAN product.

---

# Deutsch

## Übersicht

Der **eVIEW Redlining Print Assistant** ist eine Browser-Erweiterung für **Microsoft Edge** und **Google Chrome**.

Die Erweiterung unterstützt dabei, Redlinings in einem geöffneten eVIEW-Projekt zu finden, die zugehörigen Seiten automatisch zu erfassen und anschließend gemeinsam zu drucken.

Besonders bei größeren Projekten entfällt dadurch das manuelle Öffnen und Drucken jeder einzelnen Redlining-Seite.

Wenn sich mehrere passende Redlinings auf derselben eVIEW-Seite befinden, wird die Seite nur einmal zur Druckliste hinzugefügt.

---

## Funktionen

- Erkennt eVIEW-Seiten mit Redlining-Einträgen
- Filterung nach Redlining-Status
- Optionale Filterung nach Auftragsvergabe / Zuordnung
- Verhindert doppelte Seiten in der Druckliste
- Manuelles Hinzufügen der aktuell geöffneten Seite
- Gemeinsame Druckliste für mehrere Seiten
- Optimierte Druckansicht für **A4 Querformat**
- Automatische Vorbereitung der eVIEW-Seite vor der Aufnahme
- Nutzung der eVIEW-Vollbildansicht für eine größere Plan-Darstellung
- Automatische Anpassung auf **100 % Zoom**
- Wartet beim Seitenwechsel auf die Darstellung der neuen Seite
- Zusätzliche Warte-/Wiederholungslogik für langsam ladende eVIEW-Seiten
- Verarbeitung erfolgt lokal im Browser
- Keine Übertragung von eVIEW-Dokumenten an Server des Entwicklers

---

# Installation

## Möglichkeit 1 – Microsoft Edge Add-ons

Sobald die Erweiterung im Microsoft Edge Add-ons Store veröffentlicht ist, kann sie direkt über den Store installiert werden.

Bis dahin kann die Erweiterung manuell aus diesem Repository geladen werden.

---

## Möglichkeit 2 – Manuelle Installation in Microsoft Edge

### 1. Repository herunterladen

Dieses Repository als ZIP-Datei herunterladen und entpacken.

Der Ordner, der später in Edge ausgewählt wird, muss direkt die Datei

```text
manifest.json
```

enthalten.

> Den Ordner nach der Installation nicht verschieben oder löschen.

---

### 2. Erweiterungsmenü öffnen

In Microsoft Edge oben rechts auf das **Erweiterungen-Symbol** klicken.

![Erweiterungsmenü öffnen](Doku/1.png)

---

### 3. „Erweiterungen verwalten“ öffnen

Auf **Erweiterungen verwalten** klicken.

![Erweiterungen verwalten](Doku/2.png)

Alternativ direkt aufrufen:

```text
edge://extensions/
```

---

### 4. Entwicklermodus aktivieren

Links unten **Entwicklermodus** aktivieren.

![Entwicklermodus aktivieren](Doku/3.png)

---

### 5. Entpackte Erweiterung laden

Auf **Entpackte Erweiterung laden** klicken.

![Entpackte Erweiterung laden](Doku/4.png)

Den entpackten Ordner auswählen, in dem sich direkt die `manifest.json` befindet.

---

### 6. Installation prüfen

Die Erweiterung sollte anschließend unter **Aus anderen Quellen** erscheinen.

![Erweiterung installiert](Doku/5.png)

Darauf achten, dass sie aktiviert ist.

---

### 7. Erweiterung an die Symbolleiste anheften

Das Edge-Erweiterungsmenü öffnen und die Erweiterung über das **Stecknadel-Symbol** anheften.

![Erweiterung anheften](Doku/6.png)

---

# Verwendung

## 1. eVIEW-Projekt öffnen

Das gewünschte Projekt in eVIEW öffnen und zur Seiten-/Planansicht wechseln.

![eVIEW-Projekt öffnen](Doku/7.png)

Die Erweiterung arbeitet mit dem eVIEW-Projekt im aktuell geöffneten Browser-Tab.

---

## 2. Redlining Print Assistant öffnen

Auf das angeheftete Erweiterungssymbol klicken.

Der **eVIEW Redlining Print Assistant** öffnet sich.

![Redlining Print Assistant](Doku/8.png)

---

## 3. Gewünschten Redlining-Status auswählen

Unter **Status im Suchlauf** auswählen, welche Redlining-Zustände berücksichtigt werden sollen.

Je nach eVIEW-Version können beispielsweise folgende Zustände vorhanden sein:

- **Überprüfung**
- **Entwurf**
- **Bestätigt**
- **Erledigt**
- **Abgelehnt**

Nur die Zustände aktivieren, die im Drucklauf enthalten sein sollen.

---

## 4. Optional nach Auftragsvergabe filtern

Falls benötigt, **Nach Auftragsvergabe filtern** aktivieren.

Anschließend die gewünschten Werte für **Von** und **An** auswählen.

Wenn keine zusätzliche Zuordnungsfilterung benötigt wird, die Funktion deaktiviert lassen.

---

## 5. Redlining-Seiten erfassen

Auf

**Gefilterte Redlining-Seiten erfassen**

klicken.

Die Erweiterung sucht nach passenden Redlinings und sammelt die dazugehörigen eVIEW-Seiten.

Wenn mehrere passende Redlinings auf derselben Seite liegen, wird diese Seite nur einmal übernommen.

> Ein neuer Suchlauf ersetzt die zuvor automatisch erfasste Druckliste.

---

## 6. Automatische Seitenvorbereitung

Vor der Aufnahme einer Seite bereitet die Erweiterung die eVIEW-Darstellung automatisch vor.

Dazu gehören – abhängig von der aktuellen eVIEW-Oberfläche – unter anderem:

1. Wechsel auf die gefundene Redlining-Seite
2. Warten, bis die Seite geladen wurde
3. Verwendung der größtmöglichen Planansicht
4. Aktivierung der Vollbildansicht
5. Anpassung der eVIEW-Darstellung auf **100 %**
6. Kurze Stabilisierung der Darstellung
7. Aufnahme der Seite für die spätere Druckansicht

Dadurch wird verhindert, dass unnötige Seitenleisten oder zu kleine Planansichten in der endgültigen Druckausgabe landen.

---

## 7. Bei langsamer Internetverbindung

eVIEW lädt Dokumentseiten teilweise erst nach dem eigentlichen Seitenwechsel vollständig nach.

Die Erweiterung berücksichtigt dies mit zusätzlichen Wartezeiten und Wiederholungsprüfungen.

Bei einer langsamen Verbindung:

- den Suchlauf nicht abbrechen, solange noch Seiten verarbeitet werden
- den eVIEW-Tab im Vordergrund bzw. geöffnet lassen
- während des Vorgangs nicht manuell auf andere Seiten wechseln
- gegebenenfalls die längere Warte-/Slow-Connection-Option der Erweiterung verwenden

Die Verarbeitung kann dadurch etwas länger dauern, ist aber zuverlässiger.

---

## 8. Fortschritt prüfen

Die Zähler zeigen den aktuellen Stand:

- **Seiten erkannt**
- **Seiten erfasst**

![Erkannte und erfasste Seiten](Doku/9.png)

Beispiel:

```text
20 Seiten erkannt
20 Seiten erfasst
```

Vor dem Drucken sollten beide Werte möglichst übereinstimmen.

---

## 9. Druckliste verwalten

![Druckfunktionen](Doku/10.png)

### Aktuelle Seite hinzufügen

Fügt die derzeit in eVIEW angezeigte Seite manuell zur Druckliste hinzu.

### Druckliste leeren

Entfernt alle aktuell erfassten Seiten.

### Erfasste Seiten gemeinsam drucken

Erstellt eine gemeinsame Druckansicht mit allen erfassten Seiten.

---

## 10. Seiten gemeinsam drucken

Nach Auswahl von **Erfasste Seiten gemeinsam drucken** wird eine separate Druckansicht erzeugt.

![Gemeinsame Druckansicht](Doku/11.png)

Prüfen, ob alle gewünschten Seiten vorhanden sind.

Danach:

**Einmal drucken – A4 quer**

auswählen.

Empfohlene Druckeinstellungen:

```text
Papierformat: A4
Ausrichtung: Querformat
Skalierung: Standard / 100 %
```

---

# Empfohlener Ablauf

1. eVIEW-Projekt öffnen.
2. Gewünschte Redlining-Ansicht öffnen.
3. **eVIEW Redlining Print Assistant** starten.
4. Gewünschte Redlining-Status auswählen.
5. Optional Zuordnungsfilter einstellen.
6. **Gefilterte Redlining-Seiten erfassen** starten.
7. Warten, bis der Suchlauf vollständig abgeschlossen ist.
8. Prüfen, ob **Seiten erkannt** und **Seiten erfasst** übereinstimmen.
9. **Erfasste Seiten gemeinsam drucken** auswählen.
10. Druckvorschau kontrollieren.
11. **Einmal drucken – A4 quer** auswählen.

---

# Fehlerbehebung

## Es werden keine Seiten erkannt

Prüfen:

- Ist ein eVIEW-Projekt geöffnet?
- Enthält das Projekt Redlinings?
- Ist der richtige Redlining-Status ausgewählt?
- Ist ein zu strenger Zuordnungsfilter aktiviert?
- Funktioniert eVIEW selbst vollständig?
- Ist die richtige Browser-Registerkarte aktiv?

---

## Seiten erkannt, aber noch nicht alle erfasst

Wenn beispielsweise

```text
20 Seiten erkannt
17 Seiten erfasst
```

angezeigt wird, zunächst warten.

Das Laden und Vorbereiten jeder einzelnen eVIEW-Seite benötigt Zeit.

Bei langsamer Verbindung kann dies deutlich länger dauern.

---

## Eine Seite wurde nicht korrekt geladen

Den Suchlauf erneut starten.

Bei langsamer oder instabiler Internetverbindung gegebenenfalls die verlängerte Warte-/Slow-Connection-Option verwenden.

---

## Der Plan erscheint zu klein

Die Erweiterung versucht die Planansicht vor jeder Aufnahme automatisch zu maximieren und auf **100 %** anzupassen.

Falls eVIEW die Ansicht trotzdem nicht korrekt aktualisiert:

1. Suchlauf stoppen
2. eVIEW-Seite neu laden
3. Projekt erneut öffnen
4. Suchlauf erneut starten

---

## Linke oder rechte Seitenleisten beeinflussen die Planansicht

Die Erweiterung versucht die für die Aufnahme störenden eVIEW-Oberflächenelemente zu reduzieren und die größtmögliche Planfläche zu verwenden.

Da eVIEW selbst dynamisch geladen wird, kann das Verhalten je nach eVIEW-Version und Ladegeschwindigkeit leicht variieren.

---

## Erweiterung nach einem Update neu laden

Bei manueller Installation:

1. `edge://extensions/` öffnen
2. **eVIEW Redlining Print Assistant** suchen
3. **Erneut laden** auswählen
4. eVIEW-Seite neu laden

---

# Datenschutz

Der **eVIEW Redlining Print Assistant** verarbeitet die für seine Funktion erforderlichen eVIEW-Inhalte lokal im Browser.

Die Erweiterung:

- sammelt keine eVIEW-Benutzernamen oder Passwörter
- überträgt keine eVIEW-Anmeldedaten an den Entwickler
- überträgt keine eVIEW-Dokumentseiten an Server des Entwicklers
- verkauft keine Benutzerdaten
- verwendet keine Werbe- oder Trackingdienste
- verwendet keine externen Analyse-Dienste

eVIEW-Inhalte werden nur soweit verarbeitet, wie dies für die Erkennung von Redlinings, die Seitenerfassung und die Druckerstellung erforderlich ist.

Die vollständige Datenschutzerklärung befindet sich hier:

**[Privacy Policy](https://github.com/Felix-tar/Eview-Redlining-Printer/blob/main/PRIVACY.md)**

---

# Abhängigkeit von eVIEW

Die Erweiterung stellt **keinen eigenen eVIEW-Zugang** bereit.

Für die Nutzung ist ein gültiger Zugang zu einer bestehenden eVIEW-Umgebung erforderlich.

Die Erweiterung:

- erstellt keine eVIEW-Benutzerkonten
- umgeht keine eVIEW-Anmeldung
- umgeht keine Zugriffsrechte
- speichert keine eVIEW-Zugangsdaten

---

# Browser-Kompatibilität

Primär entwickelt für:

- Microsoft Edge
- Google Chrome

Andere Chromium-basierte Browser können ebenfalls funktionieren, werden jedoch nicht zwingend getestet.

---

# Repository

GitHub:

**https://github.com/Felix-tar/Eview-Redlining-Printer**

---

# Hinweis / Disclaimer

Dieses Projekt ist eine unabhängige Browser-Erweiterung.

Es handelt sich **nicht um ein offizielles Produkt von EPLAN**, sofern nicht ausdrücklich anders angegeben.

**eVIEW**, **EPLAN** sowie zugehörige Produktnamen und Marken gehören ihren jeweiligen Rechteinhabern.

---

---

# English

## Overview

**eVIEW Redlining Print Assistant** is a browser extension for **Microsoft Edge** and **Google Chrome**.

It helps users find redlining annotations inside an open eVIEW project, automatically capture the associated pages, and prepare them for a combined print job.

This can significantly reduce the manual work required in larger projects where redlinings are distributed across many different pages.

If multiple matching redlinings are located on the same eVIEW page, that page is added to the print list only once.

---

## Features

- Detects eVIEW pages containing redlining annotations
- Filters redlinings by workflow status
- Optional filtering by assignment / routing
- Avoids duplicate pages
- Allows the currently displayed page to be added manually
- Collects multiple pages into one print list
- Creates a combined **A4 landscape** print view
- Automatically prepares the eVIEW page before capture
- Uses the eVIEW fullscreen view to maximize drawing size
- Automatically adjusts the eVIEW view to **100% zoom**
- Waits for newly selected pages to load before capture
- Includes additional waiting/retry logic for slowly loading eVIEW pages
- Processes the required content locally in the browser
- Does not transmit eVIEW documents to developer-operated servers

---

# Installation

## Option 1 – Microsoft Edge Add-ons

Once the extension is published in the Microsoft Edge Add-ons Store, it can be installed directly from the store.

Until then, the extension can be installed manually from this repository.

---

## Option 2 – Manual installation in Microsoft Edge

### 1. Download the repository

Download the repository as a ZIP file and extract it.

The folder selected in Edge must directly contain:

```text
manifest.json
```

> Do not move or delete the folder after installing the unpacked extension.

---

### 2. Open the Extensions menu

Click the **Extensions** icon in the Microsoft Edge toolbar.

![Open Extensions menu](Doku/1.png)

---

### 3. Open Manage extensions

Select **Manage extensions**.

![Manage extensions](Doku/2.png)

Or open:

```text
edge://extensions/
```

---

### 4. Enable Developer mode

Enable **Developer mode**.

![Enable Developer mode](Doku/3.png)

---

### 5. Load the unpacked extension

Click **Load unpacked**.

![Load unpacked extension](Doku/4.png)

Select the extracted folder that directly contains `manifest.json`.

---

### 6. Verify the installation

The extension should now be visible under **From other sources**.

![Extension installed](Doku/5.png)

Make sure it is enabled.

---

### 7. Pin the extension

Open the Extensions menu and click the **pin icon** next to **eVIEW Redlining Print Assistant**.

![Pin extension](Doku/6.png)

---

# Usage

## 1. Open an eVIEW project

Open the required project in eVIEW and switch to the page/drawing view.

![Open eVIEW project](Doku/7.png)

The extension works with the eVIEW project in the currently active browser tab.

---

## 2. Open eVIEW Redlining Print Assistant

Click the pinned extension icon.

![Open Redlining Print Assistant](Doku/8.png)

---

## 3. Select redlining status

Under the status filter, choose which redlining workflow states should be included.

Depending on the eVIEW version, these may include:

- Review
- Draft
- Confirmed
- Completed
- Rejected

Only enable the statuses required for the current print job.

---

## 4. Optional assignment filter

If required, enable the assignment/routing filter and select the desired **From** and **To** values.

Leave this filter disabled when it is not required.

---

## 5. Capture redlining pages

Click the button used to capture the filtered redlining pages.

The extension searches for matching redlinings and collects their associated eVIEW pages.

If multiple matching redlinings are located on one page, that page is only added once.

> Starting a new scan replaces the previously automatically generated print list.

---

## 6. Automatic page preparation

Before capturing a page, the extension automatically prepares the eVIEW view.

Depending on the current eVIEW interface, this includes:

1. Navigating to the detected redlining page
2. Waiting for the page to load
3. Maximizing the available drawing area
4. Activating fullscreen view
5. Adjusting the eVIEW view to **100%**
6. Waiting briefly for the drawing to stabilize
7. Capturing the page for the final print view

This helps avoid unnecessarily small drawings or interface panels appearing in the printed output.

---

## 7. Slow internet connections

eVIEW may continue loading the actual drawing after the page navigation itself has already completed.

The extension therefore includes additional waiting and retry checks.

For slow connections:

- do not interrupt the scan while pages are still being processed
- keep the eVIEW tab open
- do not manually navigate between pages during capture
- use the extended waiting / slow-connection option if available in the installed version

Processing can take longer, but this improves reliability.

---

## 8. Check progress

The counters show:

- **Pages detected**
- **Pages captured**

![Pages detected and captured](Doku/9.png)

Example:

```text
20 pages detected
20 pages captured
```

Ideally, both values should match before printing.

---

## 9. Manage the print list

![Print controls](Doku/10.png)

### Add current page

Adds the currently displayed eVIEW page manually.

### Clear print list

Removes all currently captured pages.

### Print captured pages together

Creates a combined print view containing all collected pages.

---

## 10. Print

Open the combined print view.

![Combined print preview](Doku/11.png)

Verify that all required pages are present.

Then start the A4 landscape print function.

Recommended settings:

```text
Paper size: A4
Orientation: Landscape
Scale: Default / 100%
```

---

# Recommended workflow

1. Open the eVIEW project.
2. Open the required redlining view.
3. Start **eVIEW Redlining Print Assistant**.
4. Select the required redlining statuses.
5. Configure the optional assignment filter.
6. Start capturing the filtered redlining pages.
7. Wait for the scan to finish.
8. Verify that detected and captured page counts match.
9. Open the combined print view.
10. Check the preview.
11. Print in A4 landscape.

---

# Troubleshooting

## No pages are detected

Check:

- Is an eVIEW project open?
- Does the project contain redlinings?
- Is the correct status selected?
- Is the assignment filter too restrictive?
- Is eVIEW itself fully loaded?
- Is the correct browser tab active?

---

## Detected and captured page counts do not match

Wait until processing has fully completed.

Loading and preparing each individual eVIEW drawing takes time.

On slow connections this can take considerably longer.

---

## A page did not load correctly

Restart the scan.

For slow or unstable internet connections, use the extended waiting / slow-connection setting if available.

---

## Drawing appears too small

The extension attempts to maximize the eVIEW drawing area and adjust the view to **100%** before every capture.

If eVIEW does not update the drawing correctly:

1. Stop the scan
2. Reload the eVIEW page
3. Reopen the project
4. Start the scan again

---

## Side panels affect the drawing size

The extension attempts to reduce interface elements that interfere with page capture and to use the largest possible drawing area.

Because eVIEW is dynamically rendered, behavior may vary slightly depending on the eVIEW version and loading speed.

---

## Reloading after a local update

For manually installed versions:

1. Open `edge://extensions/`
2. Find **eVIEW Redlining Print Assistant**
3. Click **Reload**
4. Reload the eVIEW page if required

---

# Privacy

The **eVIEW Redlining Print Assistant** processes the eVIEW content required for its functionality locally inside the browser.

The extension does not:

- collect eVIEW usernames or passwords
- transmit eVIEW login credentials to the developer
- transmit eVIEW document pages to developer-operated servers
- sell user data
- use advertising or tracking services
- use external analytics services

eVIEW content is accessed only as required for redlining detection, page capture, and print generation.

Full privacy policy:

**[Privacy Policy](https://github.com/Felix-tar/Eview-Redlining-Printer/blob/main/PRIVACY.md)**

---

# eVIEW account requirement

The extension does **not** provide access to eVIEW.

A valid account for an existing eVIEW environment is required.

The extension does not:

- create eVIEW accounts
- bypass eVIEW authentication
- bypass access permissions
- store eVIEW credentials

---

# Browser compatibility

Primarily developed for:

- Microsoft Edge
- Google Chrome

Other Chromium-based browsers may also work but are not necessarily tested.

---

# Repository

GitHub:

**https://github.com/Felix-tar/Eview-Redlining-Printer**

---

# Disclaimer

This project is an independent browser extension.

It is **not an official EPLAN product** unless explicitly stated otherwise.

**eVIEW**, **EPLAN**, and related product names and trademarks belong to their respective owners.
