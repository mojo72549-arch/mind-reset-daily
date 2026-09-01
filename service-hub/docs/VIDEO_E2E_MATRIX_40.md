# Service Hub Pro – Video-E2E-Abnahmematrix

## Release-Regel

Ein Stand ist nur freigabefähig, wenn die normalen Unit-/Syntax-/Browser-Gates grün sind **und** alle 20 fachlichen Szenarien sowohl auf Mobile als auch Desktop erfolgreich laufen. Damit entstehen exakt **40 MP4-Abnahmevideos**.

Jedes Video blendet sichtbar ein:
- Testfall-ID und Titel
- fachliche Erwartung
- Ergebnis

Die Einblendung ist rein visuell (`pointer-events: none`) und beeinflusst die Bedienung nicht.

## 20 fachliche Szenarien × 2 Geräteklassen

| ID | Fachlicher Testfall | Erwartung |
|---|---|---|
| V01 | Öffentlicher Login | Keine sichtbaren Zugangsdaten, Passwort maskiert |
| V02 | Annette Login | Bürorechte und Kundenanlage verfügbar |
| V03 | Dome Login | CRM sichtbar, sensible Schreibrechte gesperrt |
| V04 | Administration | Ausschließlich Systemkonfiguration, keine operativen Listen |
| V05 | Kunde anlegen | Neuer Kunde sofort sichtbar und persistent |
| V06 | Kundenanlage abbrechen | Kein Datensatz, keine Seiteneffekte |
| V07 | Kunden-Persistenz | Kunde überlebt vollständigen Browser-Reload |
| V08 | Auftrag anlegen | Auftrag sofort sichtbar, 0 Reloads, 0 Navigationen |
| V09 | Auftrag abbrechen | Kein Auftrag, Kundenansicht bleibt unverändert |
| V10 | Auftrags-Persistenz | Auftrag nach vollständigem Reload weiterhin beim Kunden |
| V11 | Einsatz starten | Startzeit und Auftragsstatus persistent aktualisiert |
| V12 | Rapporttext speichern | Arbeiten/Ergebnis über Navigation und Reload persistent |
| V13 | Leistung hinzufügen | Sofortige UI-/Persistenz-Synchronität ohne Reload |
| V14 | Leistung löschen abbrechen | Vorhandene Leistung bleibt unverändert |
| V15 | Leistung löschen + Undo | Sofort gelöscht und korrekt wiederherstellbar |
| V16 | Material hinzufügen/löschen | Sofortige UI-/Persistenz-Synchronität |
| V17 | Rapport ohne Pflichtdaten | Abschluss wird blockiert, Status bleibt Entwurf |
| V18 | Rapport PDF/Druck | Auftrags-/Firmendaten korrekt, sicherer Rückweg |
| V19 | Admin → Rechnung | Admin-Konfiguration erscheint in Rechnungs-PDF |
| V20 | Vollständiger E2E-Prozess | Kunde → Auftrag → Rapport → Unterschriften → Rechnung → PDF |

## Geräteabdeckung

- Mobile Chromium: Pixel-5-Profil, 390 × 844 px
- Desktop Chromium: 1440 × 900 px

## Artefakte

Der GitHub-Actions-Job `40 slow E2E video reviews` zeichnet jedes Szenario auf, konvertiert alle Playwright-WebM-Dateien nach MP4, prüft hart auf **exakt 40 MP4-Dateien** und lädt anschließend das Paket `service-hub-e2e-video-review-40` für 30 Tage als Build-Artefakt hoch.
