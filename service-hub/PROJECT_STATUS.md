# Service Hub Pro – Baseline 2026-08-08

Dieser Branch friert den getesteten Stand vom 08.08.2026 ein und dient als Rückfallpunkt.

## Rollen
- Dome: Techniker / iPad
- Annette: Büro / Notebook
- Admin: Leistungskatalog, Preise und Kundenkonditionen

## Fachlicher Ablauf
Kunde -> Auftrag -> Rapport -> Rechnung -> Versand -> Zahlungsstatus

## Aktueller Funktionsumfang
- Kundenanlage und Kunden-360°
- 1 Kunde -> beliebig viele Aufträge
- Dome-Zuweisung
- Rapport mit Arbeiten, Leistungen, Unterschriften und PDF/Druck
- Rechnung aus Rapport
- Rechnungsnummern: 26175, 26180, 26185, ... (+5)
- Rechnungsstatus korrigierbar: Offen, Versendet, Teilbezahlt, Bezahlt, Überfällig, Storniert
- Leistungskatalog in der Administration
- Kundenspezifische Preise / Stundensätze vorgesehen
- Kommunikationspräferenz pro Kunde: WhatsApp, E-Mail, Post

## Wichtige technische Einschränkung des Baseline-Stands
Die GitHub-Pages-Fassung nutzt Browser-Speicher. Dome und Annette sehen deshalb noch nicht garantiert denselben zentralen Datensatz auf unterschiedlichen Geräten.

## Zielarchitektur
- GitHub: Source of Truth / Versionshistorie
- Vercel: Web-App + API
- MariaDB: zentrale persistente Datenhaltung
- Keine Replit-Abhängigkeit

## Regel
Der Baseline-Branch wird nicht für neue Features verändert. Alle weiteren Arbeiten erfolgen auf einem separaten Entwicklungsbranch und werden erst nach Regressionstests in den Produktivstand übernommen.
