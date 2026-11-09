// Trivet page glue: read the form, run the engine in core.js, turn the
// minutes-before-serving offsets into real clock times against the serving time
// you typed, draw the timeline, keep the share link in sync, and tell Pip what's
// going on. All the cooking maths lives in core.js so it can be tested without a
// browser.
(function () {
  "use strict";
  var T = window.Trivet;
  var $ = function (id) { return document.getElementById(id); };

  var ids = ["meat", "weight", "unit", "stuffed", "doneness", "serve", "rest", "frozen", "thaw-method", "people"];
  var el = {};
  ids.forEach(function (id) { el[id] = $(id); });
  var out = $("out");

  function readState() {
    return {
      me: el.meat.value,
      w: el.weight.value.trim(), u: el.unit.value,
      st: el.stuffed.checked ? 1 : 0,
      dn: el.doneness.value,
      serve: el.serve.value,
      rest: el.rest.value.trim(),
      fz: el.frozen.checked ? 1 : 0,
      tm: el["thaw-method"].value,
      pe: el.people.value.trim()
    };
  }

  function writeState(s) {
    if (!s) return;
    if (s.me) el.meat.value = s.me;
    if (s.w != null) el.weight.value = s.w;
    if (s.u) el.unit.value = s.u;
    el.stuffed.checked = !!s.st;
    if (s.dn) el.doneness.value = s.dn;
    if (s.serve) el.serve.value = s.serve;
    if (s.rest != null) el.rest.value = s.rest;
    el.frozen.checked = !!s.fz;
    if (s.tm) el["thaw-method"].value = s.tm;
    if (s.pe != null) el.people.value = s.pe;
  }

  // Fill the "how big a joint" hint from the head count and the chosen meat.
  function renderPortion(s) {
    var hint = $("portion-hint");
    if (!hint) return;
    var p = T.portionWeight(s.me, s.pe, s.u);
    if (!p) { hint.hidden = true; hint.textContent = ""; return; }
    var m = T.MEATS[s.me] || T.MEATS.turkey;
    var unitLabel = p.unit === "kg" ? "kg" : "lb";
    hint.hidden = false;
    hint.textContent = "For " + p.people + (p.people === 1 ? " person" : " people") + ", buy about " +
      p.min + "–" + p.max + " " + unitLabel + " of " + m.label.toLowerCase() +
      " (aim for " + p.aim + " " + unitLabel + "). Add a little for leftovers.";
  }

  // Build a Date for the serving time on a reference day, then step backwards by
  // a minutes offset. The reference day is "today" only so the clock maths has a
  // date to hang on; nothing is stored or sent.
  function serveDate(hhmm) {
    var now = new Date();
    var parts = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
    var h = parts ? Math.min(23, parseInt(parts[1], 10)) : 15;
    var m = parts ? Math.min(59, parseInt(parts[2], 10)) : 0;
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    return d;
  }

  function fmtClock(date) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // How many days earlier than the serving day a time falls, for a "the day
  // before" style label on an overnight thaw.
  function dayLabel(date, serve) {
    var a = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var b = new Date(serve.getFullYear(), serve.getMonth(), serve.getDate());
    var diff = Math.round((b - a) / 86400000);
    if (diff <= 0) return "";
    if (diff === 1) return "the day before";
    return diff + " days before";
  }

  function timeCell(label, date, serve, big, sub) {
    var day = dayLabel(date, serve);
    return '<div class="step' + (big ? " big" : "") + '">' +
      '<span class="step-k">' + label + '</span>' +
      '<span class="step-t">' + fmtClock(date) + '</span>' +
      (day ? '<span class="step-d">' + day + '</span>' : "") +
      (sub ? '<span class="step-s">' + sub + '</span>' : "") +
      '</div>';
  }

  function render(r, s) {
    if (!r || !r.ok) {
      var msg = r && r.reason === "bad-weight" ? "Enter the weight of the roast."
        : r && r.reason === "too-big" ? "That weight looks too big. Check the number and the unit."
        : "Pick what you're cooking and its weight to start.";
      out.innerHTML = '<div class="result bad"><h3>Nothing to time yet</h3><p class="msg">' + msg + '</p></div>';
      return "bad";
    }

    var serve = serveDate(s.serve);
    var putIn = new Date(serve.getTime() - r.inOffset * 60000);
    var outEarly = new Date(serve.getTime() - r.outEarliestOffset * 60000);
    var outLate = new Date(serve.getTime() - r.outLatestOffset * 60000);

    var sizeNote = r.clampedWeight ? " (outside the chart, using the nearest size)" : "";
    var roastText = T.hoursText(r.roastMin) + (r.roastMin === r.roastMax ? "" : " to " + T.hoursText(r.roastMax));

    var steps =
      (r.frozen && r.thaw ? timeCell("Start thawing", new Date(serve.getTime() - r.thawStartOffset * 60000), serve, false, r.thaw.label) : "") +
      timeCell("Put it in", putIn, serve, true, "oven at " + r.oven + " F") +
      timeCell("Take it out", outLate, serve, false, "or as early as " + fmtClock(outEarly)) +
      timeCell("Rest, then serve", serve, serve, false, r.restMin + " min rest");

    var meta =
      '<p class="meta">' + r.meatLabel + (r.donenessLabel ? ", " + r.donenessLabel.toLowerCase() : "") +
      (r.stuffed ? ", stuffed" : "") + " · " + r.lb + " lb (" + r.kg + " kg) · about " + roastText + sizeNote + " in the oven.</p>";

    var temps =
      '<div class="temps">' +
        '<div class="temp"><span class="temp-k">Cook to</span><span class="temp-v">' + r.safeF + ' F</span><span class="temp-u">' + r.safeC + ' C</span></div>' +
        '<div class="temp pull"><span class="temp-k">Pull it out at</span><span class="temp-v">' + r.pullF + ' F</span><span class="temp-u">' + r.pullC + ' C</span></div>' +
      '</div>' +
      (r.belowUsda ? '<p class="warnline">' + r.pullF + ' F is below the USDA safe minimum of 145 F for a whole cut. Common for beef and lamb, but your call.</p>' : "");

    var advice = '<ul class="advice">' + r.advice.map(function (a) { return "<li>" + a + "</li>"; }).join("") + "</ul>";

    out.innerHTML =
      '<div class="result">' +
        '<h3>Your timing</h3>' + meta +
        '<div class="timeline">' + steps + '</div>' +
      '</div>' +
      '<div class="result"><h3>The temperature to cook to</h3>' + temps + '</div>' +
      '<div class="result"><h3>While it cooks</h3>' + advice + '</div>';

    return r.poultry ? "poultry" : "red";
  }

  function recompute() {
    var s = readState();
    var r = T.plan({
      meat: s.me,
      weight: { value: s.w, unit: s.u },
      stuffed: !!s.st,
      doneness: s.dn,
      restMin: s.rest === "" ? undefined : s.rest,
      frozen: !!s.fz,
      thawMethod: s.tm
    });
    var kind = render(r, s);
    renderPortion(s);
    if (window.Pip) window.Pip.react(r.ok ? kind : "bad", r);
    syncLink(s);
  }

  // Show the stuffing tick for turkey, the doneness picker for red meat that has
  // one, and the thaw method only when frozen is ticked.
  function syncFields() {
    var m = T.MEATS[el.meat.value] || T.MEATS.turkey;
    $("stuffed-wrap").hidden = !m.stuffable;
    $("done-wrap").hidden = m.basis !== "rate-done";
    $("thaw-wrap").hidden = !el.frozen.checked;
    var hint = $("meat-hint");
    if (m.poultry) hint.textContent = "Poultry is cooked to 165 F right through. A whole turkey reads from the USDA size chart; others use minutes per pound.";
    else if (m.basis === "rate-done") hint.textContent = "A whole beef or lamb joint is timed to how you like it, and cooked to temperature, not the clock. USDA safe minimum is 145 F with a rest.";
    else hint.textContent = "Cooked to 145 F with a short rest (160 F if it's minced), timed by minutes per pound.";
  }

  var linkState = "";
  function syncLink(s) {
    linkState = T.pack(s);
    try { history.replaceState(null, "", "#" + linkState); } catch (e) { /* ignore */ }
  }

  $("share").addEventListener("click", function () {
    var url = location.origin + location.pathname + "#" + linkState;
    var done = $("share-done");
    function ok() { done.textContent = "Link copied"; setTimeout(function () { done.textContent = ""; }, 2500); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, function () { done.textContent = url; });
    else { done.textContent = url; }
  });

  el.meat.addEventListener("focus", function () { if (window.Pip) window.Pip.context("meat"); });
  el.weight.addEventListener("focus", function () { if (window.Pip) window.Pip.context("weight"); });
  el.serve.addEventListener("focus", function () { if (window.Pip) window.Pip.context("time"); });
  el.frozen.addEventListener("focus", function () { if (window.Pip) window.Pip.context("thaw"); });

  el.meat.addEventListener("change", function () { syncFields(); recompute(); });
  el.frozen.addEventListener("change", function () { syncFields(); recompute(); });

  ids.forEach(function (id) {
    el[id].addEventListener("input", recompute);
    el[id].addEventListener("change", recompute);
  });

  // Open on a shared link if there is one, otherwise the default turkey.
  var frag = location.hash.replace(/^#/, "");
  var initial = frag ? T.unpack(frag) : null;
  if (initial) { writeState(initial); }
  syncFields();
  recompute();
})();
