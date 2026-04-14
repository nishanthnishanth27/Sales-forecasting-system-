// ================================================================
//  SALES FORECASTING SYSTEM — Complete JavaScript
//  Copy this entire script into your HTML <script> tag
//  or save as sales_forecasting.js and link it
// ================================================================

// ── SEEDED RANDOM NUMBER GENERATOR ──────────────────────────────
function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── GENERATE REALISTIC SALES DATA ───────────────────────────────
function genData(testDays, trend, noise) {
  const r     = rng(42);
  const total = 365 * 3; // 3 years daily
  const arr   = [];

  for (let i = 0; i < total; i++) {
    let base = 1200;

    if (trend === "up")       base += i * 0.55;
    else if (trend === "down") base += i * 0.55 - i * 1.1;
    else if (trend === "seasonal") base += 280 * Math.sin((2 * Math.PI * i) / 365);

    const weekly = 140 * Math.sin((2 * Math.PI * i) / 7);
    const yearly = 190 * Math.sin((2 * Math.PI * i) / 365 - Math.PI / 2);
    const n      = (r() - 0.5) * noise * 9;
    const spike  = r() < 0.015 ? (r() > 0.5 ? 1 : -1) * noise * 14 : 0;

    arr.push(Math.max(150, base + weekly + yearly + n + spike));
  }
  return arr;
}

// ── SIMULATE MODEL PREDICTIONS ───────────────────────────────────
// quality: higher = better predictions (less error)
function simPred(actual, noise, quality) {
  const r = rng(quality * 7 + 13);
  return actual.map(function (v) {
    return Math.max(100, v + (r() - 0.5) * noise * 6 * (1 - quality / 120));
  });
}

// ── METRIC CALCULATIONS ──────────────────────────────────────────
function calcRMSE(actual, pred) {
  var sum = 0;
  for (var i = 0; i < actual.length; i++) {
    sum += Math.pow(actual[i] - pred[i], 2);
  }
  return Math.sqrt(sum / actual.length);
}

function calcMAE(actual, pred) {
  var sum = 0;
  for (var i = 0; i < actual.length; i++) {
    sum += Math.abs(actual[i] - pred[i]);
  }
  return sum / actual.length;
}

function calcMAPE(actual, pred) {
  var sum = 0;
  for (var i = 0; i < actual.length; i++) {
    sum += Math.abs((actual[i] - pred[i]) / (actual[i] + 1e-9));
  }
  return (sum / actual.length) * 100;
}

// ── SVG CHART 1: FULL TIME-SERIES ────────────────────────────────
// Shows train data + actual test + prophet forecast + xgboost forecast
function drawChart1(svgId, trainData, testActual, propPred, xgbPred) {
  var svg = document.getElementById(svgId);
  if (!svg) return;

  var W = 400, H = 160;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);

  // Combine all for range
  var all = trainData.concat(testActual, propPred, xgbPred);
  var mn  = Math.floor(Math.min.apply(null, all) * 0.94);
  var mx  = Math.ceil(Math.max.apply(null, all) * 1.06);
  var range = mx - mn || 1;

  var PAD = { t: 10, r: 6, b: 22, l: 40 };
  var cW  = W - PAD.l - PAD.r;
  var cH  = H - PAD.t - PAD.b;

  // Total points = train + test
  var total = trainData.length + testActual.length;

  // Helper: value → SVG y coordinate
  function vy(v) {
    return (PAD.t + cH * (1 - (v - mn) / range)).toFixed(2);
  }

  // Helper: index → SVG x coordinate
  function vx(i) {
    return (PAD.l + (i / (total - 1)) * cW).toFixed(2);
  }

  var html = '<rect width="' + W + '" height="' + H + '" fill="#111c2a" rx="6"/>';

  // Grid lines + Y axis labels
  for (var gi = 0; gi <= 4; gi++) {
    var gy  = PAD.t + cH * (1 - gi / 4);
    var gv  = Math.round(mn + (range * gi) / 4);
    html += '<line x1="' + PAD.l + '" y1="' + gy.toFixed(1) + '" x2="' + (PAD.l + cW) + '" y2="' + gy.toFixed(1) + '" stroke="#1a2a3a" stroke-width="1"/>';
    html += '<text x="' + (PAD.l - 3) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end" fill="#2a4060" font-size="8" font-family="monospace">' + gv + "</text>";
  }

  // Vertical split line (train / test boundary)
  var splitX = PAD.l + (trainData.length / (total - 1)) * cW;
  html += '<line x1="' + splitX.toFixed(1) + '" y1="' + PAD.t + '" x2="' + splitX.toFixed(1) + '" y2="' + (PAD.t + cH) + '" stroke="#1f3348" stroke-width="1" stroke-dasharray="3,3"/>';

  // Build polyline points for each dataset
  function buildPts(arr, offset) {
    offset = offset || 0;
    return arr.map(function (v, i) {
      return vx(i + offset) + "," + vy(v);
    }).join(" ");
  }

  // Train line (dim blue)
  html += '<polyline points="' + buildPts(trainData, 0) + '" fill="none" stroke="#2a4060" stroke-width="1" opacity="0.9"/>';

  // Test actual (cyan)
  html += '<polyline points="' + buildPts(testActual, trainData.length) + '" fill="none" stroke="#00e5ff" stroke-width="1.5"/>';

  // Prophet predictions (red dashed)
  html += '<polyline points="' + buildPts(propPred, trainData.length) + '" fill="none" stroke="#ff4d6d" stroke-width="1.3" stroke-dasharray="5,3"/>';

  // XGBoost predictions (green dashed)
  html += '<polyline points="' + buildPts(xgbPred, trainData.length) + '" fill="none" stroke="#00ff88" stroke-width="1.3" stroke-dasharray="5,3"/>';

  // X axis labels
  var xLabels = [
    { label: "Y1",   idx: 0 },
    { label: "Y1.5", idx: Math.floor(total * 0.17) },
    { label: "Y2",   idx: Math.floor(total * 0.33) },
    { label: "Y2.5", idx: Math.floor(total * 0.50) },
    { label: "Y3",   idx: Math.floor(total * 0.67) },
    { label: "Y3.5", idx: Math.floor(total * 0.83) },
  ];
  xLabels.forEach(function (xl) {
    var lx = PAD.l + (xl.idx / (total - 1)) * cW;
    html += '<text x="' + lx.toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle" fill="#2a4060" font-size="8" font-family="monospace">' + xl.label + "</text>";
  });

  svg.innerHTML = html;
}

// ── SVG CHART 2: TEST ACTUAL VS PREDICTED ────────────────────────
function drawChart2(svgId, actual, propPred, xgbPred) {
  var svg = document.getElementById(svgId);
  if (!svg) return;

  var W = 400, H = 130;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);

  var all   = actual.concat(propPred, xgbPred);
  var mn    = Math.floor(Math.min.apply(null, all) * 0.94);
  var mx    = Math.ceil(Math.max.apply(null, all) * 1.06);
  var range = mx - mn || 1;
  var n     = actual.length;

  var PAD = { t: 10, r: 6, b: 16, l: 40 };
  var cW  = W - PAD.l - PAD.r;
  var cH  = H - PAD.t - PAD.b;

  function vy(v) { return (PAD.t + cH * (1 - (v - mn) / range)).toFixed(2); }
  function vx(i) { return (PAD.l + (i / (n - 1)) * cW).toFixed(2); }

  var html = '<rect width="' + W + '" height="' + H + '" fill="#111c2a" rx="6"/>';

  for (var gi = 0; gi <= 4; gi++) {
    var gy = PAD.t + cH * (1 - gi / 4);
    var gv = Math.round(mn + (range * gi) / 4);
    html += '<line x1="' + PAD.l + '" y1="' + gy.toFixed(1) + '" x2="' + (PAD.l + cW) + '" y2="' + gy.toFixed(1) + '" stroke="#1a2a3a" stroke-width="1"/>';
    html += '<text x="' + (PAD.l - 3) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end" fill="#2a4060" font-size="8" font-family="monospace">' + gv + "</text>";
  }

  function pts(arr) {
    return arr.map(function (v, i) { return vx(i) + "," + vy(v); }).join(" ");
  }

  // Fill between actual and xgb
  var topPts  = actual.map(function (v, i) { return vx(i) + "," + vy(v); }).join(" ");
  var botPts  = xgbPred.slice().reverse().map(function (v, i) {
    return vx(n - 1 - i) + "," + vy(v);
  }).join(" ");
  html += '<polygon points="' + topPts + " " + botPts + '" fill="#00e5ff" opacity="0.05"/>';

  html += '<polyline points="' + pts(actual)  + '" fill="none" stroke="#00e5ff" stroke-width="1.5"/>';
  html += '<polyline points="' + pts(propPred) + '" fill="none" stroke="#ff4d6d" stroke-width="1.3" stroke-dasharray="5,3"/>';
  html += '<polyline points="' + pts(xgbPred)  + '" fill="none" stroke="#00ff88" stroke-width="1.3" stroke-dasharray="5,3"/>';

  svg.innerHTML = html;
}

// ── SVG CHART 3: DAILY ABSOLUTE ERROR ────────────────────────────
function drawChart3(svgId, propErr, xgbErr) {
  var svg = document.getElementById(svgId);
  if (!svg) return;

  var W = 400, H = 110;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);

  var mx    = Math.ceil(Math.max.apply(null, propErr.concat(xgbErr)) * 1.1) || 1;
  var n     = propErr.length;
  var PAD   = { t: 8, r: 6, b: 14, l: 40 };
  var cW    = W - PAD.l - PAD.r;
  var cH    = H - PAD.t - PAD.b;

  function vy(v) { return (PAD.t + cH * (1 - v / mx)).toFixed(2); }
  function vx(i) { return (PAD.l + (i / (n - 1)) * cW).toFixed(2); }

  var html = '<rect width="' + W + '" height="' + H + '" fill="#111c2a" rx="6"/>';

  for (var gi = 0; gi <= 3; gi++) {
    var gy = PAD.t + cH * (1 - gi / 3);
    html += '<line x1="' + PAD.l + '" y1="' + gy.toFixed(1) + '" x2="' + (PAD.l + cW) + '" y2="' + gy.toFixed(1) + '" stroke="#1a2a3a" stroke-width="1"/>';
    html += '<text x="' + (PAD.l - 3) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end" fill="#2a4060" font-size="8" font-family="monospace">' + Math.round((mx * gi) / 3) + "</text>";
  }

  // Baseline
  var baseY = PAD.t + cH;

  // Prophet error fill + line
  var pTop = propErr.map(function (v, i) { return vx(i) + "," + vy(v); }).join(" ");
  html += '<polygon points="' + PAD.l + "," + baseY + " " + pTop + " " + (PAD.l + cW) + "," + baseY + '" fill="#ff4d6d" opacity="0.22"/>';
  html += '<polyline points="' + pTop + '" fill="none" stroke="#ff4d6d" stroke-width="1.2"/>';

  // XGBoost error fill + line
  var xTop = xgbErr.map(function (v, i) { return vx(i) + "," + vy(v); }).join(" ");
  html += '<polygon points="' + PAD.l + "," + baseY + " " + xTop + " " + (PAD.l + cW) + "," + baseY + '" fill="#00ff88" opacity="0.18"/>';
  html += '<polyline points="' + xTop + '" fill="none" stroke="#00ff88" stroke-width="1.2"/>';

  svg.innerHTML = html;
}

// ── UPDATE COMPARISON BARS ────────────────────────────────────────
function updateBars(propRMSE, xgbRMSE, propMAE, xgbMAE) {
  var maxVal = Math.max(propRMSE, xgbRMSE, propMAE, xgbMAE);

  var bars = [
    { fillId: "bf1", valId: "bv1", val: propRMSE },
    { fillId: "bf2", valId: "bv2", val: xgbRMSE  },
    { fillId: "bf3", valId: "bv3", val: propMAE   },
    { fillId: "bf4", valId: "bv4", val: xgbMAE    },
  ];

  bars.forEach(function (b) {
    var fillEl = document.getElementById(b.fillId);
    var valEl  = document.getElementById(b.valId);
    if (fillEl) fillEl.style.width = ((b.val / maxVal) * 100).toFixed(1) + "%";
    if (valEl)  valEl.textContent  = b.val.toFixed(1);
  });
}

// ── UPDATE FEATURE IMPORTANCE BARS ───────────────────────────────
function updateFeatures() {
  var feats = [
    { name: "lag_7",  pct: 70.1 },
    { name: "lag_14", pct: 10.2 },
    { name: "rm_7",   pct: 5.8  },
    { name: "rm_14",  pct: 4.1  },
    { name: "rm_30",  pct: 2.3  },
    { name: "lag_1",  pct: 1.9  },
    { name: "rs_30",  pct: 1.5  },
    { name: "rs_7",   pct: 1.2  },
    { name: "lag_30", pct: 1.0  },
    { name: "doy",    pct: 0.9  },
  ];

  var container = document.getElementById("featRows");
  if (!container) return;

  container.innerHTML = feats.map(function (f) {
    return (
      '<div class="feat-row">' +
        '<div class="feat-name">' + f.name + "</div>" +
        '<div class="feat-track">' +
          '<div class="feat-fill" style="width:' + f.pct + '%"></div>' +
        "</div>" +
        '<div class="feat-pct">' + f.pct + "%</div>" +
      "</div>"
    );
  }).join("");
}

// ── UPDATE EVAL TABLE ─────────────────────────────────────────────
function updateEvalTable(xgbRMSE, xgbMAE, xgbMAPE, propRMSE, propMAE, propMAPE) {
  var container = document.getElementById("evalTable");
  if (!container) return;

  var xWins = xgbRMSE < propRMSE;

  container.innerHTML =
    '<table class="m-tbl">' +
      "<tr><th>MODEL</th><th>RMSE &darr;</th><th>MAE &darr;</th><th>MAPE% &darr;</th></tr>" +
      '<tr class="' + (xWins ? "best" : "") + '">' +
        "<td>XGBoost " + (xWins ? '<span class="best-tag">BEST</span>' : "") + "</td>" +
        "<td>" + xgbRMSE.toFixed(2) + "</td>" +
        "<td>" + xgbMAE.toFixed(2)  + "</td>" +
        "<td>" + xgbMAPE.toFixed(2) + "%</td>" +
      "</tr>" +
      '<tr class="' + (!xWins ? "best" : "") + '">' +
        "<td>Prophet " + (!xWins ? '<span class="best-tag">BEST</span>' : "") + "</td>" +
        "<td>" + propRMSE.toFixed(2) + "</td>" +
        "<td>" + propMAE.toFixed(2)  + "</td>" +
        "<td>" + propMAPE.toFixed(2) + "%</td>" +
      "</tr>" +
    "</table>";
}

// ── SET TEXT HELPER ───────────────────────────────────────────────
function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── MAIN PIPELINE RUNNER ──────────────────────────────────────────
function runPipeline() {
  var btn = document.getElementById("runBtn");
  if (btn) {
    btn.textContent     = "⏳ RUNNING...";
    btn.style.background = "#ffaa00";
    btn.style.color      = "#000";
  }

  // Get control values
  var testDays = parseInt(document.getElementById("testPeriod").value  || "90");
  var trend    = document.getElementById("trendType").value             || "up";
  var noise    = parseInt(document.getElementById("noiseLevel").value   || "50");

  // Progress bar
  var progBar = document.getElementById("progBar");
  function setP(p) { if (progBar) progBar.style.width = p + "%"; }
  setP(15);

  // Delay so browser can repaint the button state before heavy JS runs
  setTimeout(function () {

    // ── Step 1: Generate data ──────────────────────────
    var all       = genData(testDays, trend, noise);
    var total     = all.length;           // 1095
    var trainSize = total - testDays;
    var trainData = all.slice(0, trainSize);
    var testData  = all.slice(trainSize);

    setP(30);

    // ── Step 2: Simulate predictions ──────────────────
    var propPred = simPred(testData, noise, 55);   // Prophet — less accurate
    var xgbPred  = simPred(testData, noise, 100);  // XGBoost — more accurate

    // ── Step 3: Calculate metrics ──────────────────────
    var propRMSE = calcRMSE(testData, propPred);
    var propMAE  = calcMAE(testData,  propPred);
    var propMAPE = calcMAPE(testData, propPred);
    var xgbRMSE  = calcRMSE(testData, xgbPred);
    var xgbMAE   = calcMAE(testData,  xgbPred);
    var xgbMAPE  = calcMAPE(testData, xgbPred);

    setP(50);

    // ── Step 4: Update stat cards ──────────────────────
    setText("sTotal",    total.toLocaleString());
    setText("sTrain",    trainSize.toLocaleString());
    setText("sTest",     testDays.toString());
    setText("sPropRMSE", propRMSE.toFixed(1));
    setText("sPropMAE",  propMAE.toFixed(1));
    setText("sXGBRMSE",  xgbRMSE.toFixed(1));
    setText("sXGBMAE",   xgbMAE.toFixed(1));
    setText("p0rows",    total + " rows loaded");
    setText("p3days",    testDays.toString());
    setText("p4rmse",    propRMSE.toFixed(2));
    setText("p4mae",     propMAE.toFixed(2));
    setText("p5rmse",    xgbRMSE.toFixed(2));
    setText("p5mae",     xgbMAE.toFixed(2));

    var bestModel = xgbRMSE < propRMSE ? "XGBoost" : "Prophet";
    var bestRMSE  = Math.min(xgbRMSE, propRMSE);
    setText("sBest",    bestModel);
    setText("sBestSub", "RMSE: " + bestRMSE.toFixed(1));

    setP(65);

    // ── Step 5: Draw charts ────────────────────────────
    drawChart1("svg1", trainData, testData, propPred, xgbPred);
    drawChart2("svg2", testData, propPred, xgbPred);

    var propErr = testData.map(function (v, i) { return Math.abs(v - propPred[i]); });
    var xgbErr  = testData.map(function (v, i) { return Math.abs(v - xgbPred[i]); });
    drawChart3("svg3", propErr, xgbErr);

    setP(82);

    // ── Step 6: Update comparison bars ────────────────
    updateBars(propRMSE, xgbRMSE, propMAE, xgbMAE);

    // ── Step 7: Feature importance ────────────────────
    updateFeatures();

    // ── Step 8: Eval table ────────────────────────────
    updateEvalTable(xgbRMSE, xgbMAE, xgbMAPE, propRMSE, propMAE, propMAPE);

    setP(100);

    // Reset button
    if (btn) {
      btn.innerHTML     = "&#10003; DONE &mdash; RE-RUN";
      btn.style.background = "#00e5ff";
      btn.style.color      = "#000";
    }

  }, 300);
}

// ── TAB SWITCHING ─────────────────────────────────────────────────
function switchTab(idx) {
  var tabs   = document.querySelectorAll(".tab");
  var panels = document.querySelectorAll(".panel");
  tabs.forEach(function (t, i)   { t.classList.toggle("active", i === idx); });
  panels.forEach(function (p, i) { p.classList.toggle("active", i === idx); });
}

// ── AUTO RUN ON PAGE LOAD ─────────────────────────────────────────
window.addEventListener("DOMContentLoaded", function () {
  setTimeout(runPipeline, 400);
});
      
