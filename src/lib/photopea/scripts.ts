import type { MockupSettings } from "../../types";

function esc(value: string): string {
  return JSON.stringify(value);
}

export function buildReplaceSmartObjectScript(settings: MockupSettings): string {
  return `
var smartName = ${esc(settings.smartObjectName.trim())};
var placement = {
  left: ${settings.left},
  top: ${settings.top},
  width: ${settings.width},
  height: ${settings.height},
  rotation: ${settings.rotation},
  opacity: ${settings.opacity},
  fitMode: ${esc(settings.fitMode)},
  anchor: ${esc(settings.anchor)}
};

function collectionLength(collection) {
  try {
    return collection ? collection.length : 0;
  } catch (error) {
    return 0;
  }
}

function collectionItem(collection, index) {
  try {
    return collection[index];
  } catch (error) {
    return null;
  }
}

function isSmartObjectLayer(layer) {
  if (!layer) return false;
  try {
    if (typeof LayerKind !== "undefined" && layer.kind === LayerKind.SMARTOBJECT) return true;
  } catch (error) {}
  try {
    return String(layer.kind).toLowerCase().indexOf("smart") !== -1;
  } catch (error) {
    return false;
  }
}

function findSmartObjectLayerByName(parent, name, state) {
  var layersLength = collectionLength(parent.layers);
  if (layersLength > 0) {
    for (var i = 0; i < layersLength; i++) {
      var layer = collectionItem(parent.layers, i);
      var nested = inspectLayer(layer, name, state);
      if (nested) return nested;
    }
    return null;
  }

  var artLayersLength = collectionLength(parent.artLayers);
  for (var j = 0; j < artLayersLength; j++) {
    var artLayer = collectionItem(parent.artLayers, j);
    var artMatch = inspectLayer(artLayer, name, state);
    if (artMatch) return artMatch;
  }

  var layerSetsLength = collectionLength(parent.layerSets);
  for (var k = 0; k < layerSetsLength; k++) {
    var layerSet = collectionItem(parent.layerSets, k);
    var setMatch = inspectLayer(layerSet, name, state);
    if (setMatch) return setMatch;
  }

  return null;
}

function inspectLayer(layer, name, state) {
  if (!layer) return null;
  if (layer.name === name) {
    state.namedLayerFound = true;
    if (isSmartObjectLayer(layer)) return layer;
  }

  var nested = findSmartObjectLayerByName(layer, name, state);
  if (nested) return nested;
  return null;
}

function boundsSize(bounds) {
  return {
    left: bounds[0].value,
    top: bounds[1].value,
    right: bounds[2].value,
    bottom: bounds[3].value,
    width: bounds[2].value - bounds[0].value,
    height: bounds[3].value - bounds[1].value
  };
}

function anchorPoint(left, top, width, height, anchor) {
  if (anchor === "top-left") return { x: left, y: top };
  if (anchor === "top-right") return { x: left + width, y: top };
  if (anchor === "bottom-left") return { x: left, y: top + height };
  if (anchor === "bottom-right") return { x: left + width, y: top + height };
  return { x: left + width / 2, y: top + height / 2 };
}

function fitScale(srcW, srcH, boxW, boxH, mode) {
  if (mode === "width") return boxW / srcW;
  if (mode === "height") return boxH / srcH;
  var cover = Math.max(boxW / srcW, boxH / srcH);
  var contain = Math.min(boxW / srcW, boxH / srcH);
  return mode === "cover" ? cover : contain;
}

if (app.documents.length < 2) throw new Error("PSD and design must be open.");
var doc = app.documents[app.documents.length - 2];
var designDoc = app.documents[app.documents.length - 1];
var searchState = { namedLayerFound: false };
var targetLayer = findSmartObjectLayerByName(doc, smartName, searchState);
if (!targetLayer && searchState.namedLayerFound) throw new Error("Layer found, but it is not a smart object: " + smartName);
if (!targetLayer) throw new Error("Smart object layer not found: " + smartName);
app.activeDocument = doc;
doc.activeLayer = targetLayer;

// The uploaded design is the newest opened document. Copy it into the smart object content.
app.activeDocument = designDoc;
designDoc.selection.selectAll();
designDoc.selection.copy();
designDoc.close(SaveOptions.DONOTSAVECHANGES);

app.activeDocument = doc;
doc.activeLayer = targetLayer;
executeAction(stringIDToTypeID("placedLayerEditContents"), undefined, DialogModes.NO);
var soDoc = app.activeDocument;
soDoc.selection.selectAll();
soDoc.selection.clear();
soDoc.paste();

var pasted = soDoc.activeLayer;
var soW = soDoc.width.value;
var soH = soDoc.height.value;
var boxW = soW * placement.width / 100;
var boxH = soH * placement.height / 100;
var boxLeft = soW * placement.left / 100;
var boxTop = soH * placement.top / 100;
var scale = fitScale(pasted.bounds[2].value - pasted.bounds[0].value, pasted.bounds[3].value - pasted.bounds[1].value, boxW, boxH, placement.fitMode) * 100;
pasted.resize(scale, scale, AnchorPosition.MIDDLECENTER);

var b = boundsSize(pasted.bounds);
var from = anchorPoint(b.left, b.top, b.width, b.height, placement.anchor);
var to = anchorPoint(boxLeft, boxTop, boxW, boxH, placement.anchor);
pasted.translate(to.x - from.x, to.y - from.y);
pasted.opacity = placement.opacity;
if (placement.rotation !== 0) pasted.rotate(placement.rotation, AnchorPosition.MIDDLECENTER);

soDoc.close(SaveOptions.SAVECHANGES);
app.activeDocument = doc;
"done";
`;
}

export const exportPngScript = 'app.activeDocument.saveToOE("png");';

export const closeAllDocumentsScript = `
while (app.documents.length > 0) {
  app.activeDocument = app.documents[app.documents.length - 1];
  app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
}
"done";
`;
