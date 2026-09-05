# NEET-PG 2026 RankLab

A fast, dependency-free marks-to-AIR explorer designed for GitHub Pages.

## What it includes

- Research model v2 with 301 one-mark records from 350–650 /720
- Scenario-weighted centre plus harder, recent-baseline, mixed and easier-paper views
- Interactive log-scale AIR curve with the full harder↔easier scenario envelope
- Model-supplied local ranks-per-mark density
- Seven recall-sensitivity states from −15 to +15 and a granular ±12-mark table
- Progressive correct/wrong/unattempted calculator with live 180-question validation
- Floating answer-score chip that follows the stats and reopens for instant edits
- Question-outcome cards and a correct-answer neighbourhood table where each step explicitly swaps one wrong answer to correct (+5 marks)
- Original one-mark neighbourhood retained as an advanced alternate view
- Plain-language explainer and dated source desk
- Animated day/night themes that follow the device and remember the last choice
- Reactive rank moods, playful microcopy, particle celebrations and touch ripples
- A lightweight 2.9-second anime-tech boot sequence with a 0.8-second split reveal, skip control, and fail-safe
- Native one-tap installation on supported browsers, shown only when the system installer is ready
- Offline-ready core predictor assets, a custom app icon and Home Screen shortcuts
- Static feedback flow that opens a pre-filled email draft without storing form data
- Razorpay support link, thank-you note, Privacy Policy, Terms of Use and proprietary notice
- Strict `robots.txt` and page-level no-index directives
- Subtle Vibration API haptics on supported mobile browsers, with visual feedback everywhere
- Apple-first system typography (`-apple-system` / SF Pro on Apple devices)
- Responsive layouts for phones, tablets and desktops
- Keyboard navigation and reduced-motion support

## Important

This is an independent **pre-result research model**, not an official NBEMS predictor. The NEET-PG 2026 score–rank distribution was unavailable when the model was frozen on 3 September 2026. Do not use the estimate as the sole basis for counselling decisions.

The centre is weighted across four explicit paper-response scenarios. The full band spans the harder-paper favourable case to the easier-paper adverse case. Replace the simulation with the empirical curve after official 2026 score/rank observations become available; do not silently blend official data with the pre-result model.

## Licence and automation

Copyright © 2026 Ayush Yadav. All rights reserved. This repository is public for deployment, but no open-source licence is granted. Manual personal use by human visitors is permitted; scraping, automated access, republication, dataset creation and AI/ML use are prohibited. See `LICENSE.txt` and `terms.html`.

`robots.txt` and meta directives communicate the crawler restriction to compliant systems. They cannot technically prevent a hostile client from requesting files hosted on a public static website.

## Local use

Open `index.html` directly, or run any static file server in this directory. No dependency install is required.

For the production-output check:

```sh
npm run check
```

The build copies the public files to `dist/` for static hosting validation. GitHub Pages serves the same files directly from the repository root.
