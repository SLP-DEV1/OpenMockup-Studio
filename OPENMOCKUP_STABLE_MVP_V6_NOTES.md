# OpenMockup Studio Stable MVP v6

Diese Version baut auf der stabilen v5 auf und aktiviert die UI-Regler wieder, ohne Photopea-Layer nach `app.open()` auszulesen.

## Wichtige Änderung

Die Werte für Left, Top, Width, Height, Placement Area, Rotation, Opacity, Fit Mode und Anchor werden jetzt im Browser auf ein transparentes Canvas in PSD-Größe angewendet. Danach wird dieses fertige PNG an Photopea übergeben.

Dadurch muss Photopea nach dem Import keine Layer-Bounds, activeLayer, doc.layers oder Transform-DOM-APIs mehr lesen. Genau diese APIs hatten vorher BX-Crashes verursacht.

## Erwartete Logs

- `STEP:browserTransform:area:...`
- `STEP:browserTransform:target:...`
- `STEP:browserTransform:final:...`
- `STEP:browserTransform:done`
- `STEP:transformPlaced:appliedInBrowserCanvasV6`
- `STEP:export:done`

## Einschränkung

Die Position hängt davon ab, dass Photopea das vollflächige transparente PNG zentriert bzw. deckungsgleich in das PSD-Dokument einfügt. Bei der aktuellen PSD mit gleicher Canvas-Größe sollte das stabiler sein als Photopea-DOM-Transforms.
