# Service Hub Pro – Rollen-, Fehlerkorrektur- und Testkonzept (Quality V5)

## 1. Ziel

Das CRM darf Benutzerfehler nicht in Sackgassen führen. Jede normale Datenpflege muss entweder direkt korrigierbar sein oder einen nachvollziehbaren Rückweg besitzen. Externe bzw. rechtlich relevante Aktionen werden dagegen nicht scheinbar „zurückgedreht“, sondern über Korrektur-/Historienprozesse behandelt.

## 2. Rollenmatrix

| Funktion | Dome · Techniker | Annette · Büro | Admin |
|---|---:|---:|---:|
| Kunden sehen | ✓ | ✓ | ✓ |
| Aufträge sehen | ✓ | ✓ | ✓ |
| Rapporte sehen | ✓ | ✓ | ✓ |
| Rapporte bearbeiten/abschließen | ✓ | ✓ | ✓ |
| Rechnungen sehen | ✓ | ✓ | ✓ |
| Kundenstammdaten anlegen/ändern | – | ✓ | ✓ |
| Aufträge anlegen/verteilen | – | ✓ | ✓ |
| Rechnungsstatus/Versand bearbeiten | – | ✓ | ✓ |
| Preise/Kundenkonditionen pflegen | – | ✓ | ✓ |
| Globale Administration | – | – | ✓ |

Dome erhält damit dieselbe zentrale Sicht auf Kunden, Aufträge, Rapporte und Rechnungen, aber keine sensiblen Büro-/Preis-/Administrations-Schreibrechte.

## 3. Fehlerkorrektur

### Sofort rückgängig machbar

Für sichere interne Änderungen wird vor der Mutation ein Daten-Snapshot angelegt. Nach einer Änderung erscheint für einige Sekunden **„Rückgängig“**. Der Undo-Stack hält die letzten zehn sicheren Änderungen der Sitzung.

Abgedeckt sind unter anderem:

- Kunde anlegen / ändern
- Auftrag anlegen
- Rapporttext speichern
- Einsatz starten / beenden
- Leistung hinzufügen / entfernen
- Material hinzufügen / entfernen
- Messwert hinzufügen / entfernen
- Rapport abschließen
- Rechnung aus Rapport erzeugen
- Rechnungsstatus ändern
- globale Einstellungen, Leistungskatalog und Kundenkonditionen ändern

### Löschen aus Listen

Entfernen-Aktionen wie Leistung, Material oder Messwert haben einen sichtbaren **Löschen**-Button und eine Sicherheitsabfrage. Danach kann zusätzlich über **Rückgängig** der vorherige Stand wiederhergestellt werden.

### Nicht als Undo behandeln

Externe Aktionen wie WhatsApp-/E-Mail-Versand, Drucken oder bereits außerhalb des Systems wirksame Vorgänge dürfen nicht so dargestellt werden, als könnten sie technisch „ungesendet“ werden. Solche Vorgänge benötigen Historie/Korrektur statt falschem Undo.

## 4. Testpyramide

### Unit-Tests

`service-hub/tests/unit.test.cjs`

Prüft insbesondere:

- Rollen-Normalisierung
- Berechtigungsmatrix
- Rechnungsnummernfolge +5
- Klassifizierung undo-fähiger Aktionen
- Klassifizierung externer Side Effects
- Snapshot-/JSON-Helfer

### Frontend-/E2E-Tests

`service-hub/tests/browser.spec.js`

Playwright startet die echte Service-Hub-Oberfläche in einem mobilen Chromium-Viewport. Geprüft werden insbesondere:

- Dome sieht Kunden, Aufträge, Rapporte und Rechnungen
- Dome sieht keine Administration und keine geschützten Schreibaktionen
- Annette besitzt Büro-Schreibrechte
- Admin besitzt Administration
- Leistung kann hinzugefügt, wieder gelöscht und anschließend per Undo wiederhergestellt werden
- Kundenanlage kann per globalem Undo rückgängig gemacht werden
- Rechnungsbearbeitung ist für Dome nur lesend

## 5. CI-Gate

Workflow: `.github/workflows/service-hub-quality.yml`

Bei Änderungen unter `service-hub/**` laufen automatisch:

1. JavaScript-Syntaxprüfung
2. Unit-Tests
3. Playwright Chromium Frontend-Tests

Ein Quality-V5-Stand soll erst in die Live-Version übernommen werden, wenn diese Gates grün sind.
