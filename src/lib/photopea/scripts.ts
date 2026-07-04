import type { Anchor, FitMode } from "../../types";

function esc(value: string): string {
  return JSON.stringify(value);
}

function num(value: number, fallback: number): string {
  const parsed = Number(value);
  return JSON.stringify(Number.isFinite(parsed) ? parsed : fallback);
}

function wrap(body: string): string {
  return `
(function () {
  try {
${body}
  } catch (e) {
    app.echoToOE("ERROR:script:" + (e && e.message ? e.message : String(e)));
  }
})();
`;
}

const HELPERS = `
function _safeName(layer) {
  try { return String(layer.name || ""); } catch (e) { return ""; }
}
function _clean(value) {
  return String(value || "").replace(/^\\s+|\\s+$/g, "").replace(/\\s+/g, " ");
}
function _loose(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function _sameName(a, b) {
  return String(a || "") === String(b || "") || _clean(a) === _clean(b) || _loose(a) === _loose(b);
}
function _num(value) {
  if (value === undefined || value === null) return 0;
  try { if (value.value !== undefined) return Number(value.value) || 0; } catch (e) {}
  var n = Number(value);
  if (isFinite(n)) return n;
  var m = String(value).match(/-?\\d+(?:\\.\\d+)?/);
  return m ? Number(m[0]) : 0;
}
function _docSize(doc) {
  return { width: _num(doc.width), height: _num(doc.height) };
}
function _layerArray(layers) {
  var out = [];
  try {
    var len = layers.length || 0;
    for (var i = 0; i < len; i++) out.push(layers[i]);
  } catch (e) {}
  return out;
}
function _walkLayers(layers, parentPath, visitor) {
  var arr = _layerArray(layers);
  for (var i = 0; i < arr.length; i++) {
    var layer = arr[i];
    var name = _safeName(layer);
    var path = parentPath ? parentPath + "/" + name : name;
    var stop = false;
    try { stop = visitor(layer, path, name) === true; } catch (e) {}
    if (stop) return true;
    try {
      if (layer.layers && _walkLayers(layer.layers, path, visitor)) return true;
    } catch (e) {}
  }
  return false;
}
function _collectLayerPaths(doc) {
  var out = [];
  _walkLayers(doc.layers, "", function(layer, path) {
    out.push({ path: path, layer: layer });
    return false;
  });
  return out;
}
function _findLayerByName(doc, targetName) {
  var found = null;
  _walkLayers(doc.layers, "", function(layer, path, name) {
    if (_sameName(name, targetName)) {
      found = { layer: layer, path: path, name: name };
      return true;
    }
    return false;
  });
  return found;
}
function _switchToPsd() {
  var docs = app.documents;
  for (var i = 0; i < 20; i++) {
    try {
      var d = docs[i];
      if (!d) break;
      var src = "";
      try { src = d.source || ""; } catch (e) {}
      if (src === "OPENMOCKUP_PSD") {
        app.activeDocument = d;
        return app.activeDocument;
      }
    } catch (e) {}
  }
  return app.activeDocument;
}
function _boundsFromDom(layer) {
  try {
    var b = layer.bounds;
    var left = _num(b[0]);
    var top = _num(b[1]);
    var right = _num(b[2]);
    var bottom = _num(b[3]);
    if (isFinite(left) && isFinite(top) && isFinite(right) && isFinite(bottom) && right - left > 1 && bottom - top > 1) {
      return { left:left, top:top, right:right, bottom:bottom, width:right-left, height:bottom-top, source:"dom" };
    }
  } catch (e) {}
  return null;
}
function _boundsFromAM() {
  try {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    var desc = executeActionGet(ref);
    var b = desc.getObjectValue(stringIDToTypeID("bounds"));
    function px(key) { return b.getUnitDoubleValue(stringIDToTypeID(key)); }
    var left = px("left");
    var top = px("top");
    var right = px("right");
    var bottom = px("bottom");
    if (isFinite(left) && isFinite(top) && isFinite(right) && isFinite(bottom) && right - left > 1 && bottom - top > 1) {
      return { left:left, top:top, right:right, bottom:bottom, width:right-left, height:bottom-top, source:"am" };
    }
  } catch (e) {}
  return null;
}
function _getActiveLayerBounds(layer) {
  return _boundsFromDom(layer) || _boundsFromAM();
}
function _hideLayerByName(doc, targetName) {
  var hidden = false;
  _walkLayers(doc.layers, "", function(layer, path, name) {
    if (_sameName(name, targetName)) {
      try { layer.visible = false; hidden = true; app.echoToOE("STEP:hideTargetSmartObject:" + name); } catch (e) {}
      return true;
    }
    return false;
  });
  return hidden;
}
function _findPlacedLayer(doc) {
  var found = null;
  _walkLayers(doc.layers, "", function(layer, path, name) {
    if (_sameName(name, "OPENMOCKUP_PLACED_DESIGN")) {
      found = { layer: layer, path: path, name: name };
      return true;
    }
    return false;
  });
  return found;
}
`;

export const closeAllDocumentsScript = wrap(`${HELPERS}
  var before = 0;
  try { before = app.documents.length || 0; } catch (e) {}
  app.echoToOE("STEP:close-all:before:" + before);
  for (var i = 0; i < 30; i++) {
    try {
      if (!app.documents || app.documents.length === 0) break;
      app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
    } catch (e) {
      try { app.activeDocument.close(); } catch (e2) { break; }
    }
  }
  app.echoToOE("STEP:close-all:done");
`);

export const markPsdScript = wrap(`${HELPERS}
  var doc = app.activeDocument;
  try { doc.source = "OPENMOCKUP_PSD"; } catch (e) {}
  app.echoToOE("STEP:open:psd:" + doc.name);
  app.echoToOE("STEP:mark:psd:file");
  app.echoToOE("STEP:mark:psd:done");
`);

export function buildReadDocSizeScript(): string {
  return wrap(`${HELPERS}
  var doc = _switchToPsd();
  var size = _docSize(doc);
  app.echoToOE("STEP:readDocSize:" + Math.round(size.width) + "x" + Math.round(size.height));
`);
}

export function buildSwitchToSourceScript(_source: string): string {
  return wrap(`${HELPERS}
  var doc = _switchToPsd();
  app.echoToOE("STEP:switch:psd:" + doc.name);
  app.echoToOE("STEP:switch:done:OPENMOCKUP_PSD");
`);
}

export function buildPreviewCleanupAndSelectScript(_psdSource: string, smartObjectName: string): string {
  return wrap(`${HELPERS}
  var smartName = ${esc(smartObjectName)};
  _switchToPsd();
  app.echoToOE("STEP:smartobject:selectScriptVersion:stableNoDomV5");
  // V4 stable mode: do NOT read doc.layers and do NOT read/set doc.activeLayer here.
  // On the supplied PSD the target smart object is already the initially active layer after fresh PSD load.
  // Touching nested PSD layers through Photopea DOM can trigger internal BX crashes, so this step is only a marker.
  app.echoToOE("STEP:smartobject:selected:" + smartName + ":assumedInitialActiveNoDomV5");
  app.echoToOE("STEP:smartobject:selectDone");
`);
}

export function buildOpenAsSmartInPsdScript(designUrl: string, smartObjectName = "YouR Logo hERE"): string {
  return wrap(`${HELPERS}
  var url = ${esc(designUrl)};
  var smartName = ${esc(smartObjectName)};
  _switchToPsd();
  app.echoToOE("STEP:openAsSmartInPsd:start");
  app.echoToOE("STEP:openAsSmartInPsd:activeDoc:source=OPENMOCKUP_PSD");
  app.echoToOE("STEP:openAsSmartInPsd:selectedLayer:" + smartName + ":assumedInitialSmartObjectNoDomV5");
  window.__openmockupOpenedDesign = true;
  app.open(url, null, true);
  app.echoToOE("STEP:openAsSmartInPsd:openCalled");
`);
}

export function buildOpenAsSmartInPsdPollScript(
  left: number,
  top: number,
  width: number,
  height: number,
  rotation: number,
  opacity: number,
  fitMode: FitMode,
  anchor: Anchor,
  smartObjectName: string,
  placementX: number,
  placementY: number,
  placementW: number,
  placementH: number,
  designWidth: number,
  designHeight: number,
  docWidth: number,
  docHeight: number,
): string {
  return wrap(`${HELPERS}
  var leftPercent = ${num(left, 0)};
  var topPercent = ${num(top, 0)};
  var widthPercent = ${num(width, 100)};
  var heightPercent = ${num(height, 100)};
  var rotation = ${num(rotation, 0)};
  var opacity = ${num(opacity, 100)};
  var fitMode = ${esc(fitMode)};
  var anchor = ${esc(anchor)};
  var smartName = ${esc(smartObjectName)};
  var placementXPercent = ${num(placementX, 38)};
  var placementYPercent = ${num(placementY, 25)};
  var placementWPercent = ${num(placementW, 24)};
  var placementHPercent = ${num(placementH, 32)};
  var designW = ${num(designWidth, 1)};
  var designH = ${num(designHeight, 1)};
  var docW = ${num(docWidth, 3000)};
  var docH = ${num(docHeight, 2000)};

  function clamp(v, min, max) { v = Number(v); if (!isFinite(v)) v = min; return Math.max(min, Math.min(max, v)); }

  var doc = _switchToPsd();
  app.echoToOE("STEP:openAsSmartInPsd:poll:mode:activeLayerOnlyV4");

  var layer = null;
  var activeName = "";
  try {
    layer = doc.activeLayer;
    activeName = _safeName(layer);
  } catch (e) {
    app.echoToOE("WARN:openAsSmartInPsd:activeLayerUnavailable:" + (e && e.message ? e.message : String(e)));
    app.echoToOE("STEP:openAsSmartInPsd:pollDone");
    return;
  }

  app.echoToOE("STEP:openAsSmartInPsd:activeLayerAfterOpen:" + activeName);

  if (!layer || _sameName(activeName, smartName) || _sameName(activeName, "Ungroup") || _sameName(activeName, "Mask")) {
    app.echoToOE("STEP:openAsSmartInPsd:poll:noNewActiveLayer:" + activeName);
    app.echoToOE("STEP:openAsSmartInPsd:pollDone");
    return;
  }

  app.echoToOE("STEP:openAsSmartInPsd:createdLayer:active:" + activeName);
  try { layer.name = "OPENMOCKUP_PLACED_DESIGN"; app.echoToOE("STEP:openAsSmartInPsd:renamed:OPENMOCKUP_PLACED_DESIGN"); } catch (e) { app.echoToOE("WARN:openAsSmartInPsd:rename:" + (e && e.message ? e.message : String(e))); }
  app.echoToOE("STEP:openAsSmartInPsd:done");

  app.echoToOE("STEP:transformPlaced:start");
  app.echoToOE("STEP:transformPlaced:targetLayer:OPENMOCKUP_PLACED_DESIGN");
  app.echoToOE("STEP:transformPlaced:docSize:" + docW + "x" + docH);
  app.echoToOE("STEP:transformPlaced:designSize:" + designW + "x" + designH);
  app.echoToOE("STEP:settings:left:" + leftPercent);
  app.echoToOE("STEP:settings:top:" + topPercent);
  app.echoToOE("STEP:settings:width:" + widthPercent);
  app.echoToOE("STEP:settings:height:" + heightPercent);
  app.echoToOE("STEP:settings:placement:" + placementXPercent + "," + placementYPercent + "," + placementWPercent + "," + placementHPercent);
  app.echoToOE("STEP:settings:rotation:" + rotation);
  app.echoToOE("STEP:settings:opacity:" + opacity);
  app.echoToOE("STEP:settings:fitMode:" + fitMode);
  app.echoToOE("STEP:settings:anchor:" + anchor);

  widthPercent = clamp(widthPercent, 1, 500);
  heightPercent = clamp(heightPercent, 1, 500);
  opacity = clamp(opacity, 0, 100);
  placementXPercent = clamp(placementXPercent, 0, 100);
  placementYPercent = clamp(placementYPercent, 0, 100);
  placementWPercent = clamp(placementWPercent, 1, 100);
  placementHPercent = clamp(placementHPercent, 1, 100);
  if (placementXPercent + placementWPercent > 100) placementWPercent = Math.max(1, 100 - placementXPercent);
  if (placementYPercent + placementHPercent > 100) placementHPercent = Math.max(1, 100 - placementYPercent);

  var areaX = docW * placementXPercent / 100;
  var areaY = docH * placementYPercent / 100;
  var areaW = docW * placementWPercent / 100;
  var areaH = docH * placementHPercent / 100;
  app.echoToOE("STEP:placementArea:" + areaX.toFixed(1) + "," + areaY.toFixed(1) + "," + areaW.toFixed(1) + "," + areaH.toFixed(1));

  var targetW = areaW * widthPercent / 100;
  var targetH = areaH * heightPercent / 100;
  app.echoToOE("STEP:transformPlaced:target:" + areaX.toFixed(1) + "," + areaY.toFixed(1) + "," + targetW.toFixed(1) + "," + targetH.toFixed(1));

  var scale = 1;
  if (fitMode === "width") scale = targetW / designW;
  else if (fitMode === "height") scale = targetH / designH;
  else if (fitMode === "cover") scale = Math.max(targetW / designW, targetH / designH);
  else scale = Math.min(targetW / designW, targetH / designH);
  if (!isFinite(scale) || scale <= 0) scale = 1;
  app.echoToOE("STEP:transformPlaced:scale:" + scale.toFixed(4));

  try {
    layer.resize(scale * 100, scale * 100, AnchorPosition.TOPLEFT);
    app.echoToOE("STEP:transformPlaced:resized:" + (scale * 100).toFixed(2) + "%");
  } catch (e) { app.echoToOE("WARN:transformPlaced:resize:" + (e && e.message ? e.message : String(e))); }

  app.echoToOE("WARN:transformPlaced:translateSkipped:stableV4");

  try {
    if (rotation !== 0) { layer.rotate(rotation, AnchorPosition.MIDDLECENTER); app.echoToOE("STEP:transformPlaced:rotated:" + rotation); }
    else app.echoToOE("STEP:transformPlaced:rotationSkipped:0");
  } catch (e) { app.echoToOE("WARN:transformPlaced:rotate:" + (e && e.message ? e.message : String(e))); }

  try { layer.opacity = opacity; app.echoToOE("STEP:transformPlaced:opacity:" + opacity); }
  catch (e) { app.echoToOE("WARN:transformPlaced:opacity:" + (e && e.message ? e.message : String(e))); }

  app.echoToOE("STEP:transformPlaced:done");
  app.echoToOE("STEP:openAsSmartInPsd:pollDone");
`);
}

export function buildForceVisibleScript(layerName: string): string {
  return wrap(`${HELPERS}
  app.echoToOE("STEP:force-visible:skipped:stableV4:" + ${esc(layerName)});
  app.echoToOE("STEP:force-visible:done");
`);
}

export const stabilizeAfterSaveScript = wrap(`
  // Stable V5: no DOM document or layer inspection here.
  app.echoToOE("STEP:stabilize:skipped:stableNoDomV5");
  app.echoToOE("STEP:stabilize:done");
`);

export const exportPngScript = wrap(`
  // Stable V5: export the active document directly. app.open(url, null, true) should keep the PSD active.
  app.echoToOE("STEP:export:png:activeDocumentStableNoDomV5");
  app.activeDocument.saveToOE("png");
  app.echoToOE("STEP:export:done");
`);

// Legacy exports kept for compatibility with older imports. They intentionally no-op.
export function buildOpenSmartObjectScript(_smartObjectName: string): string {
  return wrap(`${HELPERS}
    app.echoToOE("STEP:smartobject:done");
  `);
}
