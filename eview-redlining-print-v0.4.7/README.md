# eVIEW Redlining Print Assistant – Testversion 0.4.7

Diese Chrome-/Edge-Erweiterung ist der erste Testbau für das Ziel:

1. alle Seiten eines eVIEW-Projekts mit mindestens einem Redlining finden,
2. doppelte Seiten entfernen,
3. die betroffenen Seiten in **einem einzigen Druckauftrag** ausgeben.

## Was Version 0.4.7 kann

- Neu in 0.4.7: Der Suchlauf wartet nicht mehr mit festen langen Pausen nach jedem Redlining. Er prüft dynamisch, ob der eVIEW-Viewer und die SVG-Zeichnung wirklich geladen sind. Dadurch werden bereits geladene bzw. gleiche Seiten deutlich schneller verarbeitet.
- Neu in 0.4.7: Im Popup gibt es unter **Ladezeit / Internetverbindung** drei Profile: **Schnell**, **Automatisch (empfohlen)** und **Langsam / instabil**.
- Neu in 0.4.7: Im Modus **Langsam / instabil** wartet das Add-on bis zu 18 Sekunden auf eine Zeichnung und versucht ein nicht geladenes Redlining bis zu zwei weitere Male zu öffnen. Erst danach wird der Eintrag übersprungen, statt versehentlich die vorherige Seite zu fotografieren.
- Neu in 0.4.7: Die Vollbild-/100-%-Stabilisierung wird pro Seite nur noch einmal ausgeführt. Direkt vor dem Screenshot wird ein bereits vorbereiteter Viewer nicht unnötig erneut dreimal angepasst.
- Weiterhin enthalten: echtes eVIEW-Vollbild, dauerhafter Layout-Guard gegen den weißen linken Reservestreifen und hochqualitative A4-Querformat-Aufnahme.

- Neu: Die Redlining-Liste bleibt während des gesamten automatischen Suchlaufs unsichtbar im DOM und wird nicht mehr pro Screenshot geöffnet/geschlossen.
- Neu: Die ganz linke eVIEW-Navigation (Projekte / Seiten / 3D / Geräte / Redlinings) wird während des Suchlaufs ausgeblendet, damit die Zeichenfläche mehr Breite bekommt.


- Sie durchsucht standardmäßig nur die Statusgruppe **Überprüfung** und aktiviert den Auftragsfilter **ST → MoE**.
- Im Popup können zusätzlich **Entwurf**, **Bestätigt**, **Erledigt** und **Abgelehnt** in den Suchlauf aufgenommen werden.
- Der Auftragsfilter bietet Quelle und Ziel für **ST**, **MoE**, **MoM**, **MK**, **TPL**, **SSB** und **IB** sowie die Einstellung **Beliebig**.
- Unterstriche und nachgestellte Personen-/Teamkürzel werden für die Abteilungszuordnung ignoriert. Dadurch zählen unter anderem `ST_STM`, `ST_SCH`, `ST_CSR`, `ST_EEI`, `ST_MAME` als ST, `MoE_APE`, `MoE_FFE`, `MoE_BRI`, `MoE_ZTO` als MoE und `MoM MMR` als MoM.
- Zusätze am Ziel wie `ST SW`, `ST S` oder `ST P` werden weiterhin der Grundabteilung ST zugeordnet.
- Schreibweisen wie `ST->MoE`, `ST H --> MoE`, `ST-Rei->MoE`, `ST_KWE->MoE`, `MoE_FFE->ST` und `ST-MoE` werden richtungsabhängig ausgewertet.
- Eigene, kommagetrennte Schreibweisen können als zusätzliche Treffer hinterlegt werden.
- Nicht automatisch passende oder unklare Redlinings werden nach dem Suchlauf in einer kleinen Auswahlliste angezeigt und können einzeln zum Druckauftrag hinzugefügt werden.
- Die Ermittlung und Betätigung des tatsächlichen Redlining-Klickziels entspricht wieder exakt Version 0.2.1. Status- und Auftragsfilter verändern dieses Klickziel nicht.
- Für die Bildaufnahme wird der vollständige äußere Redlining-Seitenleistencontainer kurz aus dem Layout genommen und anschließend unverändert wiederhergestellt. Damit bleibt auch kein dunkler Rahmen im Druckbild zurück. Gedruckt wird bevorzugt nur das große Zeichen-Canvas beziehungsweise die große SVG-Zeichenfläche.
- Der eVIEW-Knopf zum Einpassen der Gesamtansicht wird über seine Kennzeichnung oder ersatzweise über seine feste Position zwischen »Zoom -« und »Zoom +« erkannt. Er wird erst betätigt, nachdem die Seitenleiste entfernt und die volle Viewerbreite verfügbar ist. Dadurch bleibt die komplette Seite sichtbar und wird links nicht abgeschnitten.
- Unmittelbar vor jedem neuen Seitenscreenshot wird der Einpassen-/100-%-Knopf dreimal kurz ausgelöst. Damit kann ein verspätetes automatisches Verschieben zu einem außerhalb des Blatts liegenden Redlining die zurückgesetzte Ansicht nicht wieder überschreiben.
- Die mittig eingeblendete graue eVIEW-Anzeige »100 %« wird vor der Aufnahme erkannt und unsichtbar geschaltet, damit sie nicht auf dem Druckbild erscheint.
- Vor dem 100-%-Reset wechselt die Erweiterung über den rechten Doppelpfeil in die eVIEW-Vollbildansicht. Bei nicht eindeutig beschrifteten Bedienelementen dient der eVIEW-Shortcut **F** als Rückfalllösung.
- Der Screenshot wird erst in der Kombination **Vollbild + eingepasste 100-%-Ansicht** in den Druck-Cache übernommen. Anschließend wird der vorherige Ansichtsmodus wiederhergestellt, damit der Suchlauf in der Redlining-Liste fortfahren kann.
- Bereits bekannte Seiten werden nicht erneut als Screenshot verarbeitet; zusätzlich wartet der Suchlauf nur noch so lange auf einen tatsächlichen Seitenwechsel wie nötig.
- Vor der Ermittlung des Klickziels werden ausschließlich Zeilen aus dem ausdrücklich ausgewählten Statuscontainer zugelassen. Geöffnete, aber nicht markierte Gruppen wie **Bestätigt** oder **Erledigt** werden weder angeklickt noch als geprüft gezählt.
- Varianten mit angehängtem Kürzel wie `MoES` werden als MoE erkannt.
- Der sichtbare Knopf **Druckliste leeren** entfernt erfasste und vorgemerkte Seiten vollständig, behält aber die gewählten Filter bei.
- Das Popup ist breiter und höher ausgelegt, nutzt kompaktere Abstände und zeigt **Diagnose und Test** direkt unter dem Suchknopf.
- Sie öffnet beziehungsweise erkennt den Redlining-Bereich und prüft nur die ausgewählten Statusgruppen.
- Sie wählt die sichtbaren Redlining-Einträge an und navigiert dadurch zu deren Projektseiten.
- Sie verwendet die eindeutige eVIEW-Seiten-ID aus `/projects/.../pages/...` als Druckschlüssel.
- Mehrere Redlinings auf derselben Seite erzeugen deshalb nur eine einzige Druckseite.
- Die automatische Erfassung ersetzt den zuvor gespeicherten Seitensatz.
- Sie kann die aktuell sichtbare Schaltplanseite erfassen.
- Mehrere erfasste Seiten werden in einer gemeinsamen Druckansicht zusammengestellt; der Browser-Druckdialog wird nur einmal geöffnet.
- Die Druckausgabe ist fest auf DIN A4 im Querformat (297 × 210 mm) eingestellt.
- Jede eVIEW-Seite wird vollständig auf genau ein Blatt eingepasst und darf nicht über zwei Blätter umbrechen.
- Die Druckansicht enthält keine zusätzliche Seiten-/URL-Fußzeile mehr und nutzt die A4-Querformatfläche mit nur 4 mm Sicherheitsrand.
- Sie erstellt eine datensparsame Diagnose-Datei für die genaue Anpassung an die echte eVIEW-Oberfläche.
- Sie sendet keine Daten an einen externen Server und speichert keine Zugangsdaten.

## Installation in Microsoft Edge

1. ZIP-Datei entpacken.
2. `edge://extensions` öffnen.
3. **Entwicklermodus** einschalten.
4. **Entpackte Erweiterung laden** wählen.
5. Den Ordner `eview-redlining-print` auswählen.

## Installation in Google Chrome

1. ZIP-Datei entpacken.
2. `chrome://extensions` öffnen.
3. **Entwicklermodus** einschalten.
4. **Entpackte Erweiterung laden** wählen.
5. Den Ordner `eview-redlining-print` auswählen.

## Erster Test

1. eVIEW öffnen und ein Projekt laden.
2. Nach der Installation den eVIEW-Tab einmal neu laden.
3. Die Redlining-Übersicht öffnen (offizieller eVIEW-Shortcut: Taste `5`).
4. Kurz warten und das Erweiterungssymbol öffnen.
5. Gewünschte Statusgruppen auswählen. Standard ist **Überprüfung**.
6. Optional **Nach Auftragsvergabe filtern** aktivieren und Quelle/Ziel einstellen, zum Beispiel **ST → MoE**.
7. **Gefilterte Redlining-Seiten erfassen** drücken und den Lauf abwarten.
8. Falls unklare Einträge angezeigt werden, die gewünschten Zeilen markieren und **Markierte zum Druck hinzufügen** drücken.
9. **Erfasste Seiten gemeinsam drucken** und danach **Einmal drucken** drücken.
10. Falls ein Eintrag fehlt, unter **Diagnose und Test** eine neue Diagnose-Datei speichern.


### Start direkt im Vollbild

1. Einmal im Popup die gewünschten Status- und Auftragsfilter einstellen.
2. eVIEW in die Vollbildansicht schalten.
3. **Ctrl+Shift+8** drücken.
4. Der Suchlauf startet direkt; eine kleine Statusanzeige oben rechts zeigt den Fortschritt.
5. Nach Abschluss Vollbild verlassen, das Popup öffnen und **Erfasste Seiten gemeinsam drucken** wählen.
6. Falls Edge die Tastenkombination auf dem Rechner nicht übernimmt, kann sie unter `edge://extensions/shortcuts` geprüft oder geändert werden.

## Manueller Drucktest

1. Eine Seite so anzeigen, dass der komplette Schaltplan im sichtbaren Zeichenbereich liegt.
2. **Aktuelle Seite erfassen** drücken.
3. Für jede weitere betroffene Seite wiederholen.
4. **Erfasste Seiten gemeinsam drucken** drücken.
5. In der neuen Druckansicht **Einmal drucken** wählen.

## Hinweis

eVIEW kann ein ungelesenes Redlining beim Öffnen als gelesen markieren. Da Version 0.3.2 die Einträge zur Seitennavigation anwählt, kann sich deren Lesestatus während des automatischen Laufs ändern. Solange Chromes Druckvorschau geöffnet ist, können andere Erweiterungs-Popups vorübergehend blockiert sein; nach dem Schließen der Druckvorschau funktioniert das Popup wieder.
