# Service Hub Pro – Zielarchitektur

## Source of Truth
GitHub verwaltet Quellcode, Versionen und Änderungsverlauf.

## Hosting
Vercel stellt die öffentliche Web-App/PWA und die API bereit.

## Datenhaltung
MariaDB ist die zentrale persistente Datenbank. Browser-LocalStorage ist nur noch optionaler Offline-/Cache-Speicher, niemals die fachliche Quelle.

## Gemeinsames Datenmodell
- users / roles
- customers
- customer_contacts
- customer_price_overrides
- service_catalog
- orders
- reports
- report_lines
- report_materials
- report_measurements
- report_photos
- signatures
- invoices
- invoice_lines
- invoice_status_history
- document_deliveries
- service_intervals
- audit_log

## Zentrale Regeln
1. Dome und Annette lesen denselben Rapport-Datensatz.
2. Leistungskatalog wird ausschließlich in Administration gepflegt.
3. Standardpreis kommt aus service_catalog.
4. Kundenspezifische Preise überschreiben den Standardpreis nur für den betreffenden Kunden.
5. Bei Übernahme in Rapport/Rechnung wird der verwendete Preis als Snapshot gespeichert, damit spätere Preisänderungen alte Dokumente nicht verändern.
6. Rechnungsnummern werden serverseitig und atomar vergeben: Start 26175, dann immer +5.
7. Rechnungsstatus ist korrigierbar und jede Änderung wird historisiert.
8. Rapport und Rechnung erhalten unveränderliche Dokument-Snapshots bei Abschluss/Freigabe.
9. Versand über WhatsApp, E-Mail oder Post wird als dokumentierte Aktion gespeichert.
10. Kein Replit-Bestandteil in Produktion.

## Rollen
### Dome
- zugewiesene Aufträge
- Kunden-/Einsatzdaten ansehen
- Rapport bearbeiten
- Leistungen aus Katalog auswählen
- Materialien, Messwerte, Fotos
- Kunden-/Technikerunterschrift
- Rapport abschließen
- Rapport über bevorzugten Kommunikationskanal weitergeben

### Annette
- dieselben Kunden/Aufträge/Rapporte sehen
- Kunden und Aufträge verwalten
- Rapport öffnen
- Rechnung aus Rapport erzeugen
- Rechnung bearbeiten/freigeben
- Status ändern/korrigieren
- Versand und Zahlungsstatus
- Serviceintervalle/Kalender

### Admin
- Benutzer/Rollen
- Leistungskatalog
- Standardpreise
- kundenspezifische Preise/Stundensätze
- Zahlungsziele
- Nummernkreise
- Vorlagen
- Audit-Historie
