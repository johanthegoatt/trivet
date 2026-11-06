# Trivet

What time to put the roast in so dinner lands on the table on time and cooked through, not an hour late or dried out. Tell Trivet what you're cooking, how heavy it is and when you want to eat; it works backwards to the oven time, the time it comes out, the temperature to cook to, and, if it's still frozen, when to start thawing.

Live: https://trivet.johanthegoat.xyz

## What it does

- **Works back from your dinner time.** Enter the serving time and Trivet counts back through the rest and the roast to tell you when the oven goes on, and gives a window for when it comes out.
- **Times by what you're cooking.** A whole turkey reads from the USDA size chart (and allows extra for a stuffed bird); chicken, beef, lamb, pork and gammon go by minutes per pound.
- **Doneness for red meat.** Beef and lamb are timed to rare, medium rare, medium or well done, each with its own target temperature.
- **The temperature, front and centre.** The clock is only for when to start; the real test is the temperature in the thickest part. Trivet shows the finish temperature and has you pull the roast out a few degrees early, because it keeps cooking while it rests.
- **Thawing is part of the countdown.** Tick "frozen" and Trivet adds the thaw time before the oven: about a day in the fridge for every four pounds, or roughly half an hour a pound in cold water.
- **A share link** that reopens the same plan. The whole input lives in the link's `#fragment`, which a browser never sends to a server, so nothing you type is uploaded.

## The method

Roasting times and the whole-turkey timetable follow the USDA roasting guidance for a 325 F oven; the safe finish temperatures are the USDA safe minimum internal temperatures: 165 F for poultry, at least 145 F with a rest for a whole cut of beef, pork, lamb or veal, and 160 F for anything minced. A roast carries on cooking a few degrees after it leaves the oven (carryover), more in a big joint, so Trivet pulls it early and rests it. Frozen birds thaw in the fridge at about 24 hours per four pounds. These are planning figures to tell you when to start; a thermometer in the thickest part is the only sure test that it's done.

Sources:

- [USDA / University of Illinois Extension — turkey roasting timetable (325 F, 165 F, 20-minute rest)](https://extension.illinois.edu/turkey/traditional-roast-turkey-stuffed)
- [USDA FoodSafety.gov — safe minimum internal temperatures (poultry 165 F; roasts 145 F + rest; ground 160 F)](https://www.foodsafety.gov/food-safety-charts/meat-poultry-charts)
- [USDA FSIS — "Let's Talk Turkey" (thaw about 24 hours per 4-5 lb in the fridge; 30 min/lb in cold water)](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/poultry/lets-talk-turkey-consumer-guide-safely-roasting-turkey)

## Pip

Pip is a little meat thermometer in the corner. Tap for a tip that fits where you are in the form, and it reacts to the plan: a smile for a straightforward bird, a thoughtful look for doneness, a gentle warning when a joint is going in under the safe temperature. Everything Pip says is announced to a screen reader, and it holds still if you've asked for reduced motion.

## Run it

```
npm test        # the engine's tests (node --test, no dependencies)
```

Open `index.html` in a browser; there's no build step. The maths lives in `src/core.js` with no DOM, so the same file runs in the page and under the tests.

## Not a substitute for a thermometer

Trivet gives you planning times so you know when to start. It cannot see inside your oven. Always check the temperature in the thickest part of the meat (and the middle of any stuffing) before you serve.
