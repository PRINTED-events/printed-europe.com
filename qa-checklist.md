# QA Checklist: Visual & Functional

## 1. Header & Navigation

| # | Testfall | Erwartetes Ergebnis |
|---|----------|---------------------|
| 1.1 | Logo oben links anklicken | Weiterleitung auf `/` (Startseite) |
| 1.2 | Logo im Dark Mode prüfen | Korrektes Logo wird angezeigt (nicht invertiert/fehlend) |
| 1.3 | Menüpunkt „Schedule" anklicken | Weiterleitung auf `/schedule`, Menüpunkt aktiv hervorgehoben |
| 1.4 | Menüpunkt „Speakers" anklicken | Weiterleitung auf `/speakers` |
| 1.5 | Menüpunkt „Location" anklicken | Weiterleitung auf `/faq/location` |
| 1.6 | Menüpunkt „FAQ" anklicken | Weiterleitung auf `/faq` |
| 1.7 | Dropdown „Events" öffnen | 3 Einträge sichtbar: „PRINTED Hub", „PRINTED Worldconference", „About Printed Events" |
| 1.8 | „PRINTED Hub" anklicken | Öffnet `https://hub25.printed-europe.com` in neuem Tab |
| 1.9 | „PRINTED Worldconference" anzeigen | Beschreibung „Mai 2027 · Amsterdam" sichtbar, kein Link (Coming soon) |
| 1.10 | „About Printed Events" anklicken | Öffnet `https://printed-events.com` in neuem Tab |
| 1.11 | „Buy Tickets"-Button anklicken | Weiterleitung auf `/tickets` |
| 1.12 | „Apply as Speaker"-Button anklicken | Weiterleitung auf `/faq/cfp` |
| 1.13 | Mobile: Hamburger-Menü öffnen | Slideover öffnet sich mit allen Menüpunkten |

## 2. Schedule & Zeitzone

| # | Testfall | Erwartetes Ergebnis |
|---|----------|---------------------|
| 2.1 | Schedule-Seite öffnen | Talks werden angezeigt |
| 2.2 | Erste Uhrzeit im Schedule prüfen | Talks beginnen ca. 09:00 Uhr (nicht 07:00 Uhr wie vorher) |
| 2.3 | Systemzeit auf UTC stellen, Schedule neu laden | Angezeigte Zeiten bleiben in UTC+2 (Europe/Berlin) |
| 2.4 | Tagesselektor prüfen (falls mehrere Tage) | Tageswechsel funktioniert, korrekte Talks werden angezeigt |
| 2.5 | Live-Zeitlinie prüfen (während Konferenz) | Linie zeigt korrekte aktuelle Uhrzeit in UTC+2 |

## 3. Speaker-Seite & Bilder

| # | Testfall | Erwartetes Ergebnis |
|---|----------|---------------------|
| 3.1 | `/speakers` aufrufen | Speaker-Grid wird geladen |
| 3.2 | Speaker-Bilder prüfen | Alle Bilder laden korrekt (kein 404, kein Broken Image) |
| 3.3 | Speaker-Karte anklicken | Detailseite öffnet sich korrekt |

## 4. Footer & Social Icons

| # | Testfall | Erwartetes Ergebnis |
|---|----------|---------------------|
| 4.1 | YouTube-Icon anklicken | Öffnet `youtube.com/@printed-europe` in neuem Tab |
| 4.2 | LinkedIn-Icon anklicken | Öffnet die LinkedIn-Seite in neuem Tab |
| 4.3 | Instagram-Icon anklicken | Öffnet `instagram.com/printedeurope` in neuem Tab |
| 4.4 | TikTok-Icon anklicken | Öffnet `tiktok.com/@printedeurope` in neuem Tab |
| 4.5 | Alle Icons visuell prüfen | Kein Icon fehlt oder zeigt ein Fallback-Quadrat |

## 5. OG Image / Meta

| # | Testfall | Erwartetes Ergebnis |
|---|----------|---------------------|
| 5.1 | Startseite in Social-Media-Vorschau testen (z.B. opengraph.xyz) | OG-Bild wird korrekt gerendert, korrekte Farben |
| 5.2 | Favicon im Browser-Tab prüfen | Favicon erscheint in Dark und Light Mode korrekt |

## 6. Allgemein

| # | Testfall | Erwartetes Ergebnis |
|---|----------|---------------------|
| 6.1 | Alle externen Links öffnen in `_blank` | Kein interner Link öffnet unerwartet in neuem Tab |
| 6.2 | 404-Seite aufrufen (z.B. `/gibts-nicht`) | Fehlerseite wird angezeigt (kein leerer Bildschirm) |
| 6.3 | Dark Mode / Light Mode wechseln | Logo, Icons und Farben passen sich korrekt an |
