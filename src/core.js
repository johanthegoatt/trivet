// Trivet core: work backwards from the time you want to eat to the time the
// roast has to go in, so a Sunday dinner or a holiday bird lands on the table
// hot and cooked through instead of an hour late or dry. No DOM in here, so the
// same file runs in the page and under `node --test`.
//
// The real test of a roast is its temperature, not the clock: a thermometer in
// the thickest part is the only sure way to know it's done. So Trivet treats the
// minutes-per-pound figures as a PLANNING time for when to start, and always
// shows the temperature to cook to. It also allows for two things people forget:
// resting (a roast needs to sit before carving, and keeps cooking while it
// rests, so you pull it a few degrees early), and thawing (a frozen bird can
// take days in the fridge, so the countdown really starts before the oven does).
//
// Times come from the USDA roasting guidance (325 F oven) and the USDA safe
// minimum internal temperatures; the turkey figures follow the USDA/Illinois
// Extension timetable. They are starting points to check with a thermometer.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Trivet = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LB_PER_KG = 2.2046226218;

  // How done a red-meat roast is, with the minutes per pound at 325 F and the
  // final internal temperature you're aiming for. The USDA safe minimum for a
  // whole cut of beef, pork, veal or lamb is 145 F with a 3-minute rest; levels
  // below that are a personal choice and get a flag.
  var DONENESS = {
    "rare":        { label: "Rare",        perLb: [18, 20], finalF: 125 },
    "medium-rare": { label: "Medium rare", perLb: [20, 22], finalF: 135 },
    "medium":      { label: "Medium",      perLb: [22, 25], finalF: 145 },
    "well":        { label: "Well done",   perLb: [27, 30], finalF: 160 }
  };

  // The roasts Trivet knows. "chart" meats read a size band from the USDA turkey
  // timetable; "rate" and "rate-done" meats use minutes per pound.
  // `perPersonLb` is the raw weight to buy per person, [min, max] in pounds. A
  // bone-in roast carries more weight you don't eat, so it's about a pound a
  // head; a boneless joint is about half that. These follow standard catering
  // guidance (roughly 1 lb bone-in or 1/2 lb boneless per adult, a little more
  // for a bird if you want leftovers).
  var MEATS = {
    "turkey": {
      label: "Whole turkey", basis: "chart", poultry: true, stuffable: true,
      safeF: 165, restMin: 20, oven: 325, perPersonLb: [1.0, 1.5]
    },
    "turkey-breast": {
      label: "Turkey breast (whole)", basis: "chart-breast", poultry: true,
      safeF: 165, restMin: 15, oven: 325, perPersonLb: [0.5, 0.75]
    },
    "chicken": {
      label: "Whole chicken", basis: "rate", poultry: true, perLb: [20, 22],
      safeF: 165, restMin: 15, oven: 350, perPersonLb: [0.75, 1.0]
    },
    "beef": {
      label: "Beef roast", basis: "rate-done", safeF: 145, restMin: 20, oven: 325,
      defaultDone: "medium-rare", perPersonLb: [0.5, 0.75]
    },
    "lamb": {
      label: "Leg of lamb", basis: "rate-done", safeF: 145, restMin: 20, oven: 325,
      defaultDone: "medium", perPersonLb: [0.75, 1.0]
    },
    "pork": {
      label: "Pork loin roast", basis: "rate", perLb: [20, 25], safeF: 145,
      restMin: 15, oven: 350, perPersonLb: [0.5, 0.75]
    },
    "gammon": {
      label: "Gammon / fresh ham", basis: "rate", perLb: [22, 28], safeF: 145,
      restMin: 15, oven: 325, perPersonLb: [0.5, 0.75]
    }
  };

  // USDA whole-turkey timetable at 325 F, as [minHours, maxHours] per weight band
  // (pounds). Stuffed birds take a little longer and the stuffing itself must
  // reach 165 F.
  var TURKEY = [
    { to: 12, unstuffed: [2.75, 3.0],  stuffed: [3.0, 3.5] },
    { to: 14, unstuffed: [3.0, 3.75],  stuffed: [3.5, 4.0] },
    { to: 18, unstuffed: [3.75, 4.25], stuffed: [4.0, 4.25] },
    { to: 20, unstuffed: [4.25, 4.5],  stuffed: [4.25, 4.75] },
    { to: 24, unstuffed: [4.5, 5.0],   stuffed: [4.25, 5.25] }
  ];

  // USDA whole turkey-breast timetable at 325 F.
  var TURKEY_BREAST = [
    { to: 6, time: [1.5, 2.25] },
    { to: 8, time: [2.25, 3.25] }
  ];

  function num(v) {
    var n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(",", "."));
    return isFinite(n) ? n : NaN;
  }

  function toLb(value, unit) {
    var n = num(value);
    if (!isFinite(n)) return NaN;
    if (unit === "kg") return n * LB_PER_KG;
    if (unit === "g") return (n / 1000) * LB_PER_KG;
    if (unit === "oz") return n / 16;
    return n; // pounds
  }

  function round(x, step) { return Math.round(x / step) * step; }

  // Look up a weight in a banded chart, clamping to the ends with a flag so a
  // bird lighter or heavier than the table still gets a sensible answer.
  function band(chart, lb, which) {
    var clamped = false, row = chart[chart.length - 1];
    for (var i = 0; i < chart.length; i++) {
      if (lb <= chart[i].to) { row = chart[i]; break; }
    }
    if (lb > chart[chart.length - 1].to || lb <= 0) clamped = lb > chart[chart.length - 1].to;
    var range = which ? row[which] : row.time;
    return { minH: range[0], maxH: range[1], clamped: clamped };
  }

  // Minutes the roast itself needs, as a {min,max} range in minutes.
  function roastMinutes(meatKey, lb, opts) {
    opts = opts || {};
    var m = MEATS[meatKey] || MEATS.turkey;
    if (m.basis === "chart") {
      var b = band(TURKEY, lb, opts.stuffed ? "stuffed" : "unstuffed");
      return { min: Math.round(b.minH * 60), max: Math.round(b.maxH * 60), clamped: b.clamped, perLb: null };
    }
    if (m.basis === "chart-breast") {
      var bb = band(TURKEY_BREAST, lb, null);
      return { min: Math.round(bb.minH * 60), max: Math.round(bb.maxH * 60), clamped: bb.clamped, perLb: null };
    }
    var per = m.perLb;
    if (m.basis === "rate-done") {
      var dk = DONENESS[opts.doneness] ? opts.doneness : m.defaultDone;
      per = DONENESS[dk].perLb;
    }
    return { min: Math.round(per[0] * lb), max: Math.round(per[1] * lb), clamped: false, perLb: per };
  }

  // Thawing a frozen roast. The fridge is the safe way: allow about 24 hours for
  // every 4 pounds. Cold water is faster at about 30 minutes a pound but the
  // water has to be changed every 30 minutes and it must be cooked straight away.
  function thaw(lb, method) {
    if (!(lb > 0)) return null;
    if (method === "cold-water") {
      return { method: "cold-water", minutes: Math.ceil(lb * 30), label: "cold water (change every 30 min)" };
    }
    // fridge, rounded up to the next quarter-day so you start in good time
    var hours = Math.ceil((lb / 4) * 24);
    hours = Math.max(hours, 24);
    return { method: "fridge", minutes: hours * 60, label: "in the fridge" };
  }

  // How big a joint or bird to buy for a number of people. Multiplies the
  // per-person raw weight for the meat by the head count and returns a range in
  // both pounds and kilograms, with the midpoint to aim for. Bone-in roasts and
  // birds carry weight you don't eat, so they come out heavier per head than a
  // boneless joint; add a person or two if you want proper leftovers.
  function portionWeight(meatKey, people, unit) {
    var m = MEATS[meatKey] || MEATS.turkey;
    var n = Math.max(0, Math.floor(num(people)));
    if (!(n > 0) || !m.perPersonLb) return null;
    var minLb = m.perPersonLb[0] * n;
    var maxLb = m.perPersonLb[1] * n;
    var midLb = (minLb + maxLb) / 2;
    function toUnit(lb) { return unit === "kg" ? lb / LB_PER_KG : lb; }
    return {
      people: n,
      unit: unit === "kg" ? "kg" : "lb",
      minLb: Math.round(minLb * 10) / 10,
      maxLb: Math.round(maxLb * 10) / 10,
      minKg: Math.round((minLb / LB_PER_KG) * 10) / 10,
      maxKg: Math.round((maxLb / LB_PER_KG) * 10) / 10,
      min: Math.round(toUnit(minLb) * 10) / 10,
      max: Math.round(toUnit(maxLb) * 10) / 10,
      aim: Math.round(toUnit(midLb) * 10) / 10
    };
  }

  // The whole plan. Everything is returned as minutes-before-serving offsets so
  // the page can turn them into clock times against whatever serving time the
  // user typed, without this file needing to know the date.
  function plan(opts) {
    opts = opts || {};
    var meatKey = MEATS[opts.meat] ? opts.meat : "turkey";
    var m = MEATS[meatKey];

    var lb = toLb(opts.weight && opts.weight.value, opts.weight && opts.weight.unit);
    if (!(lb > 0)) return { ok: false, reason: "bad-weight" };
    if (lb > 60) return { ok: false, reason: "too-big" };

    var stuffed = !!opts.stuffed && m.stuffable;
    var doneKey = (m.basis === "rate-done" && DONENESS[opts.doneness]) ? opts.doneness : m.defaultDone;

    var roast = roastMinutes(meatKey, lb, { stuffed: stuffed, doneness: doneKey });
    var rp = num(opts.restMin);
    var rest = isFinite(rp) ? Math.max(0, Math.round(rp)) : m.restMin;

    // Pull the roast a few degrees before the target: it keeps cooking as it
    // rests (carryover), more in a big joint than a small one.
    var carry = m.poultry ? 5 : (lb >= 8 ? 10 : 5);
    var finalF = m.poultry ? m.safeF : (DONENESS[doneKey] ? DONENESS[doneKey].finalF : m.safeF);
    var pullF = Math.max(finalF - carry, 0);

    // Offsets before serving time, in minutes. The oven goes in earliest so the
    // longer end of the range still lands on time; if it's done at the shorter
    // end you hold it warm.
    var outLatest = rest;                 // out of the oven no later than this (rest before serving)
    var inOffset = rest + roast.max;      // put it in this long before serving
    var outEarliest = rest + (roast.max - roast.min); // earliest it might be ready, from serving
    var totalActive = roast.max + rest;

    var thawInfo = null, thawStartOffset = null;
    if (opts.frozen) {
      thawInfo = thaw(lb, opts.thawMethod);
      if (thawInfo) thawStartOffset = inOffset + thawInfo.minutes;
    }

    var belowUsda = (!m.poultry && m.basis === "rate-done" && DONENESS[doneKey] && DONENESS[doneKey].finalF < 145);

    var out = {
      ok: true,
      meat: meatKey,
      meatLabel: m.label,
      oven: m.oven,
      poultry: !!m.poultry,
      stuffed: stuffed,
      doneness: m.basis === "rate-done" ? doneKey : null,
      donenessLabel: m.basis === "rate-done" ? DONENESS[doneKey].label : null,
      lb: Math.round(lb * 10) / 10,
      kg: Math.round((lb / LB_PER_KG) * 10) / 10,
      roastMin: roast.min,
      roastMax: roast.max,
      perLb: roast.perLb,
      clampedWeight: roast.clamped,
      restMin: rest,
      safeF: m.safeF,
      safeC: Math.round((m.safeF - 32) * 5 / 9),
      pullF: pullF,
      pullC: Math.round((pullF - 32) * 5 / 9),
      carry: carry,
      belowUsda: belowUsda,
      // offsets before serving, minutes
      inOffset: inOffset,
      outLatestOffset: outLatest,
      outEarliestOffset: outEarliest,
      totalActive: totalActive,
      frozen: !!opts.frozen,
      thaw: thawInfo,
      thawStartOffset: thawStartOffset
    };
    out.advice = advise(out);
    return out;
  }

  function hoursText(min) {
    var h = Math.floor(min / 60), mm = min % 60;
    if (h === 0) return mm + " min";
    if (mm === 0) return h + " hr";
    return h + " hr " + mm + " min";
  }

  function advise(r) {
    var tips = [];
    tips.push("Cook to " + r.safeF + " F (" + r.safeC + " C)" + (r.poultry ? " in the thickest part of the thigh" : "") +
      ". A thermometer is the only sure test; the time is just so you know when to start.");
    tips.push("Pull it out at about " + r.pullF + " F (" + r.pullC + " C): it climbs another " + r.carry +
      " F or so while it rests, and resting lets the juices settle so it carves better.");
    if (r.stuffed) tips.push("Stuffed bird: the stuffing itself must reach 165 F, so check the middle of the stuffing too, not just the meat.");
    if (r.poultry) tips.push("Start checking the temperature about 30 to 45 minutes before the end, since every oven and bird runs a little differently.");
    if (r.belowUsda) tips.push("That's below the USDA safe minimum of 145 F for a whole cut. It's a common choice for beef and lamb, but it's your call.");
    if (r.frozen && r.thaw) {
      tips.push("Frozen: allow " + hoursText(r.thaw.minutes) + " to thaw " + r.thaw.label + " before it even goes in, so the countdown really starts then.");
    }
    tips.push("If it's ready early, it'll hold in a low oven (about 70 C) covered loosely, so starting on the earlier side is safer than cutting it fine.");
    return tips;
  }

  // The whole input goes in the URL fragment, which a browser never sends to a
  // server, so a shared link reopens the same plan without anything leaving the
  // device.
  function pack(state) {
    var json = JSON.stringify(state);
    var b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, "utf8").toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function unpack(text) {
    try {
      var b64 = String(text).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var json = typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
      var o = JSON.parse(json);
      return o && typeof o === "object" ? o : null;
    } catch (e) { return null; }
  }

  return {
    LB_PER_KG: LB_PER_KG, MEATS: MEATS, DONENESS: DONENESS, TURKEY: TURKEY, TURKEY_BREAST: TURKEY_BREAST,
    num: num, toLb: toLb, round: round, band: band, roastMinutes: roastMinutes, thaw: thaw,
    portionWeight: portionWeight,
    hoursText: hoursText, plan: plan, advise: advise, pack: pack, unpack: unpack
  };
});
