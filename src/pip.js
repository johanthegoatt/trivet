// Pip, the little meat thermometer who helps you time a roast. Pip offers a tip
// when tapped, smiles on a straightforward job, looks thoughtful about doneness,
// gives a gentle warning when a roast is going in under the safe temperature,
// and does a happy wiggle if you tap five times fast. Everything Pip says goes
// through the bubble's live region, so a screen reader hears it too. Moods are
// driven by the app, never on a timer of their own.
(function () {
  "use strict";
  var btn = document.getElementById("pip");
  var bubble = document.getElementById("pip-bubble");
  var dock = document.getElementById("pip-dock");
  var hide = document.getElementById("pip-hide");
  if (!btn) { window.Pip = { react: function () {}, context: function () {}, say: function () {} }; return; }

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var baseMood = "calm", tipKey = "start";
  var bubbleTimer = null, flashTimer = null, taps = [], tipAt = {};

  var TIPS = {
    start: [
      "Hi, I'm Pip! Tell me what you're cooking, how heavy it is and when you want to eat, and I'll tell you when to put it in.",
      "The clock tells you when to start. I tell you when it's done, which is when it hits the right temperature inside.",
      "Start a bit early if you can. A roast that's ready too soon waits happily; a late one holds up dinner."
    ],
    meat: [
      "A whole turkey reads from the USDA size chart. Chicken, beef, lamb and pork go by minutes per pound.",
      "Stuffing inside a bird adds time, and the stuffing has to get to 165 F too, so check the middle of it.",
      "Weigh it with any giblets and stuffing out, or the time runs long."
    ],
    weight: [
      "Heavier means longer, but not by a straight line, so I lean on the USDA chart for turkey.",
      "Pounds or kilograms, whichever's on the label. I'll do the swap.",
      "Not sure of the weight? The supermarket label or the butcher's ticket usually says."
    ],
    time: [
      "Tell me when you want to sit down, and I'll count back through the rest and the roast to the oven time.",
      "The rest matters: a roast keeps cooking a few degrees and the juices settle, so don't skip it.",
      "Leave the rest blank and I'll use the usual time for what you're cooking."
    ],
    thaw: [
      "Frozen? In the fridge, allow about a day for every four pounds. A big turkey can be three or four days.",
      "Cold water is quicker, about half an hour a pound, but change the water every 30 minutes and cook it right after.",
      "Never thaw on the counter: the outside sits too warm while the middle's still solid."
    ],
    result: [
      "Pop the thermometer in the thickest part, not touching bone. That reading is the real test, not the clock.",
      "I've got you pulling it out a few degrees early, because it climbs while it rests.",
      "If it's done before you're ready, cover it loosely and hold it in a low oven, around 70 C."
    ]
  };

  function setMood(m) { btn.setAttribute("data-mood", m); }

  function say(text, ms) {
    if (dock.classList.contains("tucked")) return;
    bubble.textContent = text;
    bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.textContent = ""; }, ms || 7000);
  }

  function flash(m, ms) {
    setMood(m);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { setMood(baseMood); }, ms || 1500);
  }

  function tip() {
    var list = TIPS[tipKey] || TIPS.start;
    var i = tipAt[tipKey] || 0;
    say(list[i % list.length]);
    tipAt[tipKey] = i + 1;
  }

  function steam() {
    if (still.matches) return;
    var rect = btn.getBoundingClientRect();
    for (var i = 0; i < 6; i++) {
      (function (n) {
        var s = document.createElement("span");
        s.className = "puff";
        s.style.left = (rect.left + 18 + Math.random() * 10) + "px";
        s.style.top = (rect.top + 6) + "px";
        s.style.setProperty("--dx", (Math.random() * 40 - 20) + "px");
        s.style.animationDelay = (n * 0.08) + "s";
        document.body.appendChild(s);
        setTimeout(function () { s.remove(); }, 1300);
      })(i);
    }
  }

  btn.addEventListener("click", function () {
    var now = Date.now();
    taps = taps.filter(function (t) { return now - t < 900; });
    taps.push(now);
    if (taps.length >= 5) { taps = []; steam(); say("Reading's climbing... that's the good smell getting to me!"); flash("happy"); return; }
    tip();
    flash("think", 900);
  });

  hide.addEventListener("click", function () {
    var tucked = dock.classList.toggle("tucked");
    hide.textContent = tucked ? "" : "tuck away";
    if (!tucked) { say("Back! Tap me any time for a tip."); }
  });

  // Eyes track the pointer a little, so Pip feels awake. Cheap, eyes only.
  if (!still.matches) {
    document.addEventListener("pointermove", function (e) {
      var r = btn.getBoundingClientRect();
      var dx = Math.max(-2, Math.min(2, (e.clientX - (r.left + r.width / 2)) / 60));
      var face = btn.querySelector(".pip-face");
      if (face) face.style.transform = "translateX(" + dx + "px)";
    }, { passive: true });
  }

  window.Pip = {
    // Where the user is, so the next tip fits: "meat", "weight", "time", "thaw".
    context: function (key) { tipKey = TIPS[key] ? key : "start"; baseMood = "calm"; setMood(baseMood); },
    // React to a result. r carries the plan so Pip can speak to it.
    react: function (kind, r) {
      tipKey = "result";
      if (kind === "bad") { flash("think"); say("Tell me the roast and the weight and I'll time it for you."); return; }
      if (r && r.belowUsda) { flash("warn"); say("Going in for a pink middle. Tasty, just know it's under the safe number."); }
      else if (kind === "poultry") { flash("happy"); say("Poultry, straight to 165 F. I've timed it to land with a rest before you serve."); }
      else { flash("think"); say("Timed and ready. Cook to the temperature, not the clock, and pull it a touch early."); }
    },
    say: say
  };

  setTimeout(function () { if (!dock.classList.contains("tucked")) say(TIPS.start[0]); }, 900);
})();
