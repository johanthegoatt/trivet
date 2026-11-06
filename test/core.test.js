"use strict";
const test = require("node:test");
const assert = require("node:assert");
const T = require("../src/core.js");

test("weight converts: kg and oz match pounds", () => {
  assert.ok(Math.abs(T.toLb(1, "kg") - 2.2046) < 0.001);
  assert.strictEqual(T.toLb(16, "oz"), 1);
  assert.ok(Math.abs(T.toLb(500, "g") - 1.1023) < 0.001);
  assert.strictEqual(T.toLb(5, "lb"), 5);
});

test("turkey reads the USDA band and stuffed takes longer", () => {
  const un = T.plan({ meat: "turkey", weight: { value: 16, unit: "lb" }, stuffed: false });
  const st = T.plan({ meat: "turkey", weight: { value: 16, unit: "lb" }, stuffed: true });
  assert.ok(un.ok && st.ok);
  // 14-18 lb band: unstuffed 3.75-4.25 h = 225-255 min
  assert.strictEqual(un.roastMin, 225);
  assert.strictEqual(un.roastMax, 255);
  assert.ok(st.roastMax >= un.roastMin); // stuffed at least as long
});

test("turkey bands step up with weight", () => {
  const small = T.plan({ meat: "turkey", weight: { value: 10, unit: "lb" } });
  const big = T.plan({ meat: "turkey", weight: { value: 22, unit: "lb" } });
  assert.ok(big.roastMax > small.roastMax);
});

test("a bird over the chart is clamped to the top band with a flag", () => {
  const huge = T.plan({ meat: "turkey", weight: { value: 30, unit: "lb" } });
  assert.ok(huge.ok);
  assert.strictEqual(huge.clampedWeight, true);
  // uses the 20-24 band
  assert.strictEqual(huge.roastMax, 300);
});

test("rate meats use minutes per pound", () => {
  const chicken = T.plan({ meat: "chicken", weight: { value: 5, unit: "lb" } });
  assert.ok(chicken.ok);
  // 20-22 min/lb x 5 = 100-110
  assert.strictEqual(chicken.roastMin, 100);
  assert.strictEqual(chicken.roastMax, 110);
  assert.deepStrictEqual(chicken.perLb, [20, 22]);
});

test("beef doneness changes the time and the target temperature", () => {
  const rare = T.plan({ meat: "beef", weight: { value: 4, unit: "lb" }, doneness: "rare" });
  const well = T.plan({ meat: "beef", weight: { value: 4, unit: "lb" }, doneness: "well" });
  assert.ok(rare.ok && well.ok);
  assert.ok(well.roastMax > rare.roastMax);
  assert.strictEqual(rare.safeF, 145);          // USDA min is unchanged
  assert.strictEqual(rare.belowUsda, true);     // but rare is below it
  assert.strictEqual(well.belowUsda, false);
});

test("pull temperature is below the target by the carryover", () => {
  const r = T.plan({ meat: "beef", weight: { value: 10, unit: "lb" }, doneness: "medium" });
  // medium final 145, big joint carryover 10 -> pull 135
  assert.strictEqual(r.pullF, 135);
  assert.strictEqual(r.carry, 10);
});

test("poultry carryover is a steady 5 F", () => {
  const r = T.plan({ meat: "turkey", weight: { value: 16, unit: "lb" } });
  assert.strictEqual(r.carry, 5);
  assert.strictEqual(r.pullF, 160); // 165 - 5
});

test("put-in offset is the roast (long end) plus the rest", () => {
  const r = T.plan({ meat: "chicken", weight: { value: 5, unit: "lb" }, restMin: 15 });
  // roastMax 110 + rest 15 = 125 min before serving
  assert.strictEqual(r.inOffset, 125);
  assert.strictEqual(r.outLatestOffset, 15);          // out at least a rest before serving
  assert.strictEqual(r.outEarliestOffset, 15 + (110 - 100)); // earliest ready, from serving
});

test("frozen adds a thaw start before the oven", () => {
  const r = T.plan({ meat: "turkey", weight: { value: 16, unit: "lb" }, frozen: true, thawMethod: "fridge" });
  assert.ok(r.frozen && r.thaw);
  // 16 lb / 4 x 24 h = 96 h = 5760 min in the fridge
  assert.strictEqual(r.thaw.minutes, 96 * 60);
  assert.strictEqual(r.thawStartOffset, r.inOffset + r.thaw.minutes);
});

test("cold-water thaw is about 30 min a pound", () => {
  const info = T.thaw(12, "cold-water");
  assert.strictEqual(info.minutes, 360);
  assert.strictEqual(info.method, "cold-water");
});

test("rest time can be overridden and never goes negative", () => {
  const r = T.plan({ meat: "beef", weight: { value: 4, unit: "lb" }, restMin: 0 });
  assert.strictEqual(r.restMin, 0);
  const d = T.plan({ meat: "beef", weight: { value: 4, unit: "lb" }, restMin: -5 });
  assert.strictEqual(d.restMin, 0);
});

test("bad or impossible weight is reported, not guessed", () => {
  assert.strictEqual(T.plan({ meat: "turkey" }).reason, "bad-weight");
  assert.strictEqual(T.plan({ meat: "turkey", weight: { value: 0, unit: "lb" } }).reason, "bad-weight");
  assert.strictEqual(T.plan({ meat: "turkey", weight: { value: 200, unit: "lb" } }).reason, "too-big");
});

test("hoursText formats minutes as hours and minutes", () => {
  assert.strictEqual(T.hoursText(45), "45 min");
  assert.strictEqual(T.hoursText(60), "1 hr");
  assert.strictEqual(T.hoursText(135), "2 hr 15 min");
});

test("share link round-trips the state", () => {
  const state = { me: "turkey", w: "16", u: "lb", st: 1, serve: "15:00" };
  const packed = T.pack(state);
  assert.deepStrictEqual(T.unpack(packed), state);
  assert.strictEqual(T.unpack("@@not-base64@@!!"), null);
});
