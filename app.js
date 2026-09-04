(() => {
  "use strict";

  const rawModel = window.NEETPG_MODEL_V2;
  if (!rawModel || !Array.isArray(rawModel.records)) return;

  const model = {
    ...rawModel,
    version: "2026.09.03-research-v2",
    updated: "2026-09-03",
    candidateCount: rawModel.candidateCount2026,
    referenceCandidateCount2025: 230019,
    defaultMarks: rawModel.userCase?.marks ?? 508,
    minMarks: rawModel.range.minMarks,
    maxMarks: rawModel.range.maxMarks,
    totalMarks: rawModel.exam.maxMarks,
    questions: rawModel.exam.questions,
    anchors: rawModel.records.map((record) => ({
      ...record,
      air: record.weighted,
      low: record.best,
      high: record.worst
    })),
    lenses: {
      weighted: {
        key: "air",
        label: "Scenario-weighted centre",
        note: "The planning centre: 45% recent baseline, 25% harder, 15% mixed and 15% easier-paper scenarios.",
        color: "#b9ff45"
      },
      harder: {
        key: "harder",
        label: "Harder-paper scenario",
        note: "A tougher paper produces better separation at the same raw score. This is the favourable edge of the band.",
        color: "#63d8ff"
      },
      baseline: {
        key: "baseline",
        label: "Recent baseline",
        note: "The calibrated recent upper-tail pattern, adapted to the new 180-question paper and 2026 cohort.",
        color: "#8ab4ff"
      },
      mixed: {
        key: "mixed",
        label: "Mixed-response scenario",
        note: "Models a split response where some candidates benefit more than others from the clinical format.",
        color: "#c6a6ff"
      },
      easier: {
        key: "easier",
        label: "Easier-paper scenario",
        note: "More candidates cluster above the same raw score. This is the adverse edge of the scenario band.",
        color: "#ffb86a"
      }
    }
  };

  const $ = (id) => document.getElementById(id);
  const marksInput = $("markNumber");
  const marksRange = $("markRange");
  const chart = $("rankChart");
  const lensSwitch = document.querySelector(".lens-switch");
  const themeToggle = $("themeToggle");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const celebrationLayer = $("celebrationLayer");
  const bootScreen = $("bootScreen");
  const bootSkip = $("bootSkip");
  const bootProgress = $("bootProgress");
  const bootPercent = $("bootPercent");
  const bootStatus = $("bootStatus");
  const installAppOpen = $("installAppOpen");
  const installNudge = $("installNudge");
  const installPrimary = $("installPrimary");
  const scoreCalculatorDialog = $("scoreCalculatorDialog");
  const scoreCalculatorForm = $("scoreCalculatorForm");
  const answerInputs = [$("correctAnswers"), $("wrongAnswers"), $("unattemptedAnswers")];
  const recallScoreDock = $("recallScoreDock");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const numberFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  const compactFormat = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

  const lensOrder = ["weighted", "harder", "baseline", "mixed", "easier"];
  const chartState = {};
  let selectedMarks = model.defaultMarks;
  let selectedLens = "weighted";
  let displayedRank = null;
  let counterFrame = null;
  let renderFrame = null;
  let draggingChart = false;
  let quipTimer = null;
  let lastSliderHaptic = selectedMarks;
  let deferredInstallPrompt = null;
  let installNudgeTimer = null;
  let recallAnswerState = null;
  let recallDockTimer = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const format = (value) => numberFormat.format(Math.round(value));

  const hapticPatterns = {
    soft: 6,
    tap: 10,
    select: 14,
    success: [10, 32, 15],
    celebrate: [12, 30, 18, 34, 24]
  };

  function haptic(kind = "tap") {
    if (reduceMotion.matches || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(hapticPatterns[kind] || hapticPatterns.tap);
  }

  function setupBootSequence() {
    if (!bootScreen) {
      document.documentElement.classList.remove("is-booting");
      return;
    }

    if (reduceMotion.matches) {
      bootScreen.remove();
      document.documentElement.classList.remove("is-booting");
      document.documentElement.classList.add("boot-complete");
      return;
    }

    const started = performance.now();
    const runTime = 2100;
    const exitTime = 800;
    let progressFrame = null;
    let dismissed = false;
    let keyHandler = null;

    const tick = (now) => {
      if (dismissed) return;
      const progress = clamp((now - started) / runTime, 0, 1);
      const percent = Math.round(progress * 100);
      bootProgress.style.setProperty("--boot-scale", progress.toFixed(3));
      bootPercent.textContent = String(percent).padStart(2, "0");
      bootStatus.textContent = progress < 0.34
        ? "Mapping score curve"
        : progress < 0.72
          ? "Stress-testing the band"
          : "Keeping the copium out";
      if (progress < 1) progressFrame = requestAnimationFrame(tick);
    };

    const dismiss = (wasSkipped = false) => {
      if (dismissed) return;
      dismissed = true;
      window.clearTimeout(autoDismiss);
      if (progressFrame) cancelAnimationFrame(progressFrame);
      if (keyHandler) document.removeEventListener("keydown", keyHandler);
      bootProgress.style.setProperty("--boot-scale", "1");
      bootPercent.textContent = "100";
      bootStatus.textContent = "Curve online";
      bootScreen.classList.add("is-leaving");
      document.documentElement.classList.remove("is-booting");
      document.documentElement.classList.add("boot-complete");
      if (wasSkipped) haptic("select");

      const returnFocus = document.activeElement === bootSkip;
      window.setTimeout(() => {
        bootScreen.remove();
        if (returnFocus) document.querySelector(".skip-link")?.focus({ preventScroll: true });
      }, exitTime);
    };

    const autoDismiss = window.setTimeout(() => dismiss(false), runTime);
    progressFrame = requestAnimationFrame(tick);
    bootSkip.addEventListener("click", () => dismiss(true));
    keyHandler = (event) => {
      if (event.key === "Escape") dismiss(true);
    };
    document.addEventListener("keydown", keyHandler);
  }

  function showQuip(message) {
    const toast = $("quipToast");
    const text = $("quipText");
    if (!toast || !text || !message) return;
    window.clearTimeout(quipTimer);
    text.textContent = message;
    toast.classList.remove("is-showing");
    void toast.offsetWidth;
    toast.classList.add("is-showing");
    quipTimer = window.setTimeout(() => toast.classList.remove("is-showing"), 2300);
  }

  function setupInstallExperience() {
    const canUseServiceWorker = "serviceWorker" in navigator && /^(https?:)$/.test(location.protocol);
    if (canUseServiceWorker) {
      const register = () => navigator.serviceWorker.register("./sw.js").catch(() => {});
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    if (!installAppOpen || !installNudge || !installPrimary) return;

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const isStandalone = () => standaloneQuery.matches || navigator.standalone === true;
    const canRequestNativeInstall = () => Boolean(deferredInstallPrompt) || typeof navigator.install === "function";
    const dismissWindow = 7 * 24 * 60 * 60 * 1000;
    const installMemoryWindow = 180 * 24 * 60 * 60 * 1000;

    const readTime = (key) => {
      try { return Number(localStorage.getItem(key)) || 0; } catch (_) { return 0; }
    };
    const rememberTime = (key) => {
      try { localStorage.setItem(key, String(Date.now())); } catch (_) { /* storage may be unavailable */ }
    };
    const wasDismissedRecently = () => Date.now() - readTime("ranklab-install-dismissed-at") < dismissWindow;
    const wasInstalledRecently = () => Date.now() - readTime("ranklab-app-installed-at") < installMemoryWindow;

    const updateInstallCopy = () => {
      $("installNudgeKicker").textContent = "Native install ready";
      $("installNudgeTitle").textContent = "One tap. RankLab becomes an app.";
      $("installNudgeCopy").textContent = "Full-screen, offline-ready, and out of your tab jungle.";
      $("installPrimaryLabel").textContent = "Install now";
      installAppOpen.querySelector(".install-trigger-label").textContent = "Install";
      installAppOpen.setAttribute("aria-label", "Install RankLab with the browser's native app installer");
    };

    const hideNudge = (remember = false) => {
      window.clearTimeout(installNudgeTimer);
      installNudgeTimer = null;
      installNudge.classList.remove("is-visible");
      document.body.classList.remove("has-install-nudge");
      if (remember) rememberTime("ranklab-install-dismissed-at");
      window.setTimeout(() => { installNudge.hidden = true; }, reduceMotion.matches ? 0 : 360);
    };

    const showNudge = (force = false) => {
      if (!canRequestNativeInstall() || isStandalone() || wasInstalledRecently() || (!force && wasDismissedRecently())) return;
      updateInstallCopy();
      installNudge.hidden = false;
      document.body.classList.add("has-install-nudge");
      requestAnimationFrame(() => requestAnimationFrame(() => installNudge.classList.add("is-visible")));
    };

    const scheduleNudge = () => {
      if (!canRequestNativeInstall() || installNudgeTimer || wasDismissedRecently() || wasInstalledRecently()) return;
      const delay = Math.max(450, 3800 - performance.now());
      installNudgeTimer = window.setTimeout(() => {
        installNudgeTimer = null;
        showNudge();
      }, delay);
    };

    const showInstallControl = (autoSuggest = false) => {
      if (!canRequestNativeInstall() || isStandalone()) return;
      installAppOpen.hidden = false;
      installAppOpen.classList.add("is-ready");
      updateInstallCopy();
      if (autoSuggest) scheduleNudge();
    };

    const hideInstallControl = () => {
      hideNudge(false);
      installAppOpen.hidden = true;
      installAppOpen.classList.remove("is-ready");
    };

    const requestInstall = async () => {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      hideNudge(false);
      haptic("select");

      try {
        let choice;
        if (promptEvent) {
          const promptResult = await promptEvent.prompt();
          choice = promptResult?.outcome ? promptResult : await promptEvent.userChoice;
        } else if (typeof navigator.install === "function") {
          choice = await navigator.install();
        } else {
          hideInstallControl();
          return;
        }

        hideInstallControl();
        if (!choice || choice.outcome !== "dismissed") {
          rememberTime("ranklab-app-installed-at");
          haptic("success");
          showQuip("Installed. Your tab just got promoted to app status.");
        } else {
          rememberTime("ranklab-install-dismissed-at");
          showQuip("Install declined. No tutorial ambush. Promise.");
        }
      } catch (_) {
        hideInstallControl();
        showQuip("The browser pulled the install switch. Reload and try once more.");
      }
    };

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      showInstallControl(true);
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      rememberTime("ranklab-app-installed-at");
      hideNudge(false);
      installAppOpen.hidden = true;
      document.body.classList.add("is-standalone");
      haptic("success");
      showQuip("Installed. RankLab now lives rent-free on your Home Screen.");
    });

    if (isStandalone()) {
      rememberTime("ranklab-app-installed-at");
      document.body.classList.add("is-standalone");
      return;
    }

    installAppOpen.addEventListener("click", requestInstall);
    installPrimary.addEventListener("click", requestInstall);
    $("installNudgeClose").addEventListener("click", () => { haptic("soft"); hideNudge(true); });
    $("installLater").addEventListener("click", () => { haptic("soft"); hideNudge(true); });

    if (typeof navigator.install === "function") showInstallControl(true);

    if (typeof standaloneQuery.addEventListener === "function") {
      standaloneQuery.addEventListener("change", (event) => {
        if (!event.matches) return;
        rememberTime("ranklab-app-installed-at");
        hideNudge(false);
        installAppOpen.hidden = true;
        document.body.classList.add("is-standalone");
      });
    }
  }

  function themeCopy(theme) {
    return theme === "light"
      ? { label: "Switch to night mode", short: "Night mode", color: "#f4f7f6" }
      : { label: "Switch to day mode", short: "Day mode", color: "#070b0c" };
  }

  function commitTheme(theme, remember = true) {
    const copy = themeCopy(theme);
    document.documentElement.dataset.theme = theme;
    themeToggle.setAttribute("aria-label", copy.label);
    themeToggle.setAttribute("aria-pressed", String(theme === "light"));
    $("themeText").textContent = copy.short;
    if (themeMeta) themeMeta.setAttribute("content", copy.color);
    if (remember) {
      try { localStorage.setItem("ranklab-theme", theme); } catch (_) { /* preferences can fail silently */ }
    }
  }

  function setTheme(theme, options = {}) {
    const nextTheme = theme === "light" ? "light" : "dark";
    const animate = options.animate !== false && !reduceMotion.matches;
    const swap = () => commitTheme(nextTheme, options.remember !== false);

    if (!animate || typeof document.startViewTransition !== "function") {
      swap();
    } else {
      const rect = themeToggle.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const transition = document.startViewTransition(swap);
      transition.ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 720, easing: "cubic-bezier(.22,1,.36,1)", pseudoElement: "::view-transition-new(root)" }
        );
      }).catch(() => {});
    }

    if (options.announce !== false) {
      haptic("select");
      showQuip(nextTheme === "light" ? "Vitamin D mode. Same honest maths." : "Night shift unlocked. The curve still has receipts.");
    }
  }

  function celebrate(strength = 1) {
    if (!celebrationLayer || reduceMotion.matches) return;
    const panel = celebrationLayer.parentElement.getBoundingClientRect();
    const origin = $("airKpi").getBoundingClientRect();
    const x = origin.left + origin.width * 0.58 - panel.left;
    const y = origin.top + origin.height * 0.5 - panel.top;
    const colors = ["var(--acid)", "var(--cyan)", "var(--orange)", "var(--text)"];
    const count = clamp(12 + strength * 3, 12, 28);

    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("i");
      const angle = (-155 + Math.random() * 130) * (Math.PI / 180);
      const distance = 52 + Math.random() * (62 + strength * 8);
      particle.className = `celebration-particle particle-${index % 3}`;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.setProperty("--burst-x", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--burst-y", `${Math.sin(angle) * distance}px`);
      particle.style.setProperty("--burst-r", `${Math.round(Math.random() * 240 - 120)}deg`);
      particle.style.setProperty("--burst-delay", `${Math.random() * 90}ms`);
      particle.style.background = colors[index % colors.length];
      celebrationLayer.appendChild(particle);
      particle.addEventListener("animationend", () => particle.remove(), { once: true });
    }
  }

  function moodFor(rank) {
    if (rank <= 500) return { tier: "stellar", color: "103, 161, 19", copy: "Main-character score. Still read the band." };
    if (rank <= 2000) return { tier: "fire", color: "103, 161, 19", copy: "Okay. This is properly cooking." };
    if (rank <= 10000) return { tier: "bright", color: "0, 126, 168", copy: "Very much in the conversation." };
    if (rank <= 25000) return { tier: "steady", color: "0, 126, 168", copy: "This has options. Strategy hat on." };
    if (rank <= 50000) return { tier: "plan", color: "185, 92, 0", copy: "No spiral. We plan from the range." };
    return { tier: "breathe", color: "193, 65, 60", copy: "Deep breath. A model is not a verdict." };
  }

  function setupMagneticSurfaces(root = document) {
    if (!finePointer.matches || reduceMotion.matches) return;
    root.querySelectorAll(".magnetic-surface:not([data-magnetic-ready])").forEach((surface) => {
      surface.dataset.magneticReady = "true";
      surface.addEventListener("pointermove", (event) => {
        if (event.target.closest(".magnetic-surface") !== surface) {
          surface.classList.remove("is-magnetic");
          return;
        }
        const rect = surface.getBoundingClientRect();
        const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
        surface.style.setProperty("--spot-x", `${x * 100}%`);
        surface.style.setProperty("--spot-y", `${y * 100}%`);
        surface.style.setProperty("--tilt-x", `${(0.5 - y) * 2.1}deg`);
        surface.style.setProperty("--tilt-y", `${(x - 0.5) * 2.5}deg`);
        surface.classList.add("is-magnetic");
      });
      surface.addEventListener("pointerleave", () => {
        surface.classList.remove("is-magnetic");
        surface.style.removeProperty("--tilt-x");
        surface.style.removeProperty("--tilt-y");
      });
    });
  }

  function createTapEcho(event) {
    if (reduceMotion.matches || event.button > 0 || !event.target.closest("button, summary, .text-link, tbody tr")) return;
    const echo = document.createElement("i");
    echo.className = "tap-echo";
    echo.style.left = `${event.clientX}px`;
    echo.style.top = `${event.clientY}px`;
    document.body.appendChild(echo);
    echo.addEventListener("animationend", () => echo.remove(), { once: true });
  }

  function rankAt(mark, key = "air") {
    const value = clamp(Number(mark), model.minMarks, model.maxMarks);
    const anchors = model.anchors;

    if (value <= anchors[0].marks) return anchors[0][key];
    if (value >= anchors[anchors.length - 1].marks) return anchors[anchors.length - 1][key];

    for (let index = 0; index < anchors.length - 1; index += 1) {
      const left = anchors[index];
      const right = anchors[index + 1];
      if (value < left.marks || value > right.marks) continue;
      if (value === left.marks) return left[key];
      if (value === right.marks) return right[key];

      const ratio = (value - left.marks) / (right.marks - left.marks);
      return Math.exp(Math.log(left[key]) + ratio * (Math.log(right[key]) - Math.log(left[key])));
    }

    return anchors[anchors.length - 1][key];
  }

  function localDensity(mark, key = "air") {
    if (key === "air" && Number.isInteger(mark)) {
      const record = model.anchors[mark - model.minMarks];
      if (record?.marks === mark && Number.isFinite(record.weightedDensity)) return record.weightedDensity;
    }

    const lowMark = clamp(mark - 0.5, model.minMarks, model.maxMarks);
    const highMark = clamp(mark + 0.5, model.minMarks, model.maxMarks);
    const span = Math.max(0.5, highMark - lowMark);
    return Math.max(0, (rankAt(lowMark, key) - rankAt(highMark, key)) / span);
  }

  function percentile(rank) {
    return clamp(100 * (1 - (rank - 1) / model.candidateCount), 0, 100);
  }

  function animateRank(target) {
    const output = $("airKpi");
    const finalValue = Math.round(target);

    if (counterFrame) cancelAnimationFrame(counterFrame);
    output.classList.remove("is-updating");
    void output.offsetWidth;
    output.classList.add("is-updating");

    if (reduceMotion.matches || displayedRank === null) {
      displayedRank = finalValue;
      output.textContent = format(finalValue);
      return;
    }

    const startValue = displayedRank;
    const difference = finalValue - startValue;
    const started = performance.now();
    const duration = 340;

    const tick = (now) => {
      const progress = clamp((now - started) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      displayedRank = startValue + difference * eased;
      output.textContent = format(displayedRank);

      if (progress < 1) {
        counterFrame = requestAnimationFrame(tick);
      } else {
        displayedRank = finalValue;
        output.textContent = format(finalValue);
        counterFrame = null;
      }
    };

    counterFrame = requestAnimationFrame(tick);
  }

  function setMarks(nextMarks, options = {}) {
    const numeric = Number(nextMarks);
    if (!Number.isFinite(numeric)) return;
    const previous = selectedMarks;
    const next = clamp(Math.round(numeric), model.minMarks, model.maxMarks);
    if (!options.fromCalculator && recallAnswerState?.applied && next !== recallAnswerState.marks) hideRecallScoreDock();
    selectedMarks = next;
    if (selectedMarks === previous) return;

    if (options.haptic) haptic(options.haptic);
    if (options.celebrate && selectedMarks > previous) {
      celebrate(Math.max(1, Math.round((selectedMarks - previous) / 5)));
      if (!options.haptic) haptic(selectedMarks - previous >= 10 ? "celebrate" : "success");
    }
    if (options.quip) showQuip(typeof options.quip === "function" ? options.quip(selectedMarks - previous) : options.quip);
    scheduleRender();
  }

  function setLens(nextLens, options = {}) {
    if (!model.lenses[nextLens] || nextLens === selectedLens) return;
    selectedLens = nextLens;

    document.querySelectorAll("[data-lens]").forEach((button) => {
      const active = button.dataset.lens === selectedLens;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    lensSwitch.dataset.index = String(lensOrder.indexOf(selectedLens));
    if (options.feedback) {
      haptic("select");
      const lensQuips = {
        weighted: "Four scenarios, one sober centre. Nice.",
        harder: "Hard-mode paper. Friendlier rank curve.",
        baseline: "Recent-years energy, rebuilt for 180 questions.",
        mixed: "Same paper, different candidate reactions. Plot twist.",
        easier: "Crowded curve selected. Planning armour on."
      };
      showQuip(lensQuips[selectedLens]);
    }
    scheduleRender();
  }

  function showModal(dialogElement, focusElement) {
    if (!dialogElement) return;
    if (typeof dialogElement.showModal === "function") dialogElement.showModal();
    else dialogElement.setAttribute("open", "");
    window.setTimeout(() => focusElement?.focus({ preventScroll: true }), 40);
  }

  function closeModal(dialogElement) {
    if (!dialogElement) return;
    if (typeof dialogElement.close === "function") dialogElement.close();
    else dialogElement.removeAttribute("open");
  }

  function hideRecallScoreDock() {
    if (!recallScoreDock || recallScoreDock.hidden) return;
    window.clearTimeout(recallDockTimer);
    recallScoreDock.classList.remove("is-visible");
    document.body.classList.remove("has-recall-score");
    recallDockTimer = window.setTimeout(() => { recallScoreDock.hidden = true; }, reduceMotion.matches ? 0 : 320);
  }

  function showRecallScoreDock() {
    if (!recallScoreDock || !recallAnswerState) return;
    window.clearTimeout(recallDockTimer);
    $("recallDockMarks").textContent = String(recallAnswerState.marks);
    $("recallDockBreakdown").textContent = `${recallAnswerState.correct}C · ${recallAnswerState.wrong}W · ${recallAnswerState.unattempted}U`;
    recallScoreDock.hidden = false;
    document.body.classList.add("has-recall-score");
    requestAnimationFrame(() => requestAnimationFrame(() => recallScoreDock.classList.add("is-visible")));
  }

  function readAnswerCalculator() {
    const values = answerInputs.map((input) => input.value.trim() === "" ? NaN : Number(input.value));
    const validValues = values.every((value) => Number.isInteger(value) && value >= 0 && value <= model.questions);
    const [correct, wrong, unattempted] = values;
    const total = validValues ? correct + wrong + unattempted : NaN;
    const marks = validValues ? correct * 4 - wrong : NaN;
    return { correct, wrong, unattempted, total, marks, validValues };
  }

  function updateAnswerCalculator() {
    const state = readAnswerCalculator();
    const result = $("calculatorResult");
    const useButton = $("scoreCalculatorUse");
    let resultState = "pending";
    let status = "Enter whole numbers from 0 to 180.";
    let totalCopy = "Check the answer counts";

    answerInputs.forEach((input) => {
      const value = Number(input.value);
      input.setAttribute("aria-invalid", String(input.value === "" || !Number.isInteger(value) || value < 0 || value > model.questions));
    });

    if (state.validValues) {
      $("calculatedMarks").textContent = String(state.marks);
      totalCopy = `${state.total} / ${model.questions} accounted`;
      if (state.total < model.questions) {
        status = `${model.questions - state.total} question${model.questions - state.total === 1 ? "" : "s"} left to account for.`;
      } else if (state.total > model.questions) {
        resultState = "error";
        status = `Remove ${state.total - model.questions} answer${state.total - model.questions === 1 ? "" : "s"}.`;
      } else if (state.marks < model.minMarks || state.marks > model.maxMarks) {
        resultState = "outside";
        status = `Marks calculated. Rank prediction currently covers ${model.minMarks}–${model.maxMarks}.`;
      } else {
        resultState = "ready";
        status = "Ready for the predictor.";
      }
    } else {
      $("calculatedMarks").textContent = "—";
    }

    $("calculatorTotal").textContent = totalCopy;
    $("calculatorStatus").textContent = status;
    result.dataset.state = resultState;
    const canUse = resultState === "ready";
    useButton.disabled = !canUse;
    $("scoreCalculatorUseLabel").textContent = canUse
      ? `Use ${state.marks} marks`
      : resultState === "outside"
        ? `Outside ${model.minMarks}–${model.maxMarks} range`
        : "Complete all 180";
    return { ...state, canUse };
  }

  function openAnswerCalculator() {
    haptic("select");
    updateAnswerCalculator();
    showModal(scoreCalculatorDialog, $("correctAnswers"));
  }

  function closeAnswerCalculator() {
    haptic("soft");
    closeModal(scoreCalculatorDialog);
  }

  function setupAnswerCalculator() {
    if (!scoreCalculatorDialog || !scoreCalculatorForm || answerInputs.some((input) => !input)) return;

    $("answerCalcOpen").addEventListener("click", openAnswerCalculator);
    $("recallScoreEdit").addEventListener("click", openAnswerCalculator);
    $("recallScoreDismiss").addEventListener("click", () => { haptic("soft"); hideRecallScoreDock(); });
    $("scoreCalculatorClose").addEventListener("click", closeAnswerCalculator);
    $("scoreCalculatorCancel").addEventListener("click", closeAnswerCalculator);

    answerInputs.forEach((input) => input.addEventListener("input", updateAnswerCalculator));
    document.querySelectorAll("[data-answer-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = $(button.dataset.answerInput);
        const next = clamp((Number(input.value) || 0) + Number(button.dataset.answerStep), 0, model.questions);
        input.value = String(next);
        haptic("soft");
        updateAnswerCalculator();
        input.focus({ preventScroll: true });
      });
    });

    scoreCalculatorForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const state = updateAnswerCalculator();
      if (!state.canUse) return;
      const previous = selectedMarks;
      recallAnswerState = { ...state, applied: true };
      setMarks(state.marks, {
        fromCalculator: true,
        haptic: state.marks === previous ? undefined : state.marks > previous ? "success" : "select",
        celebrate: state.marks > previous,
        quip: state.marks === previous ? undefined : "Answers counted. Curve updated. Brain tabs: one fewer."
      });
      if (state.marks === previous) {
        haptic("success");
        showQuip("Answers counted. Same score, now with receipts.");
      }
      showRecallScoreDock();
      closeModal(scoreCalculatorDialog);
    });

    scoreCalculatorDialog.addEventListener("click", (event) => {
      if (event.target !== scoreCalculatorDialog) return;
      const rect = scoreCalculatorDialog.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) closeAnswerCalculator();
    });

    updateAnswerCalculator();
  }

  function scheduleRender() {
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = null;
      render();
    });
  }

  function renderRecall(currentRank, key) {
    const rail = $("recallRail");
    const deltas = [-15, -10, -5, 0, 5, 10, 15];
    const fragment = document.createDocumentFragment();

    deltas.forEach((delta) => {
      const mark = clamp(selectedMarks + delta, model.minMarks, model.maxMarks);
      const result = rankAt(mark, key);
      const movement = currentRank - result;
      const card = document.createElement("button");
      card.type = "button";
      card.className = `recall-card magnetic-surface${delta === 0 ? " is-current" : ""}`;
      card.dataset.mark = String(mark);

      const scenario = delta === 0
        ? "Your score"
        : `${Math.abs(delta / 5)} flip${Math.abs(delta) === 5 ? "" : "s"} ${delta > 0 ? "better" : "worse"}`;
      const movementCopy = delta === 0
        ? "Weighted model centre"
        : `<strong>${format(Math.abs(movement))}</strong> places ${movement >= 0 ? "better" : "worse"}`;

      card.setAttribute("aria-label", `${scenario}: ${mark} marks, predicted AIR ${format(result)}`);
      card.innerHTML = `
        <span class="recall-delta"><span>${scenario}</span><i aria-hidden="true">${delta > 0 ? "↗" : delta < 0 ? "↘" : "·"}</i></span>
        <span><strong class="recall-rank">AIR ${format(result)}</strong><span class="recall-move">${movementCopy}</span></span>
      `;
      card.addEventListener("click", () => {
        setMarks(mark, {
          haptic: delta > 0 ? "success" : "tap",
          celebrate: delta > 0,
          quip: delta > 0 ? "Plot twist accepted. Nice." : delta < 0 ? "Stress-tested. No catastrophising allowed." : "Back to your selected score."
        });
        marksInput.focus({ preventScroll: true });
      });
      fragment.appendChild(card);
    });

    rail.replaceChildren(fragment);
    setupMagneticSurfaces(rail);
  }

  function renderTable() {
    const body = $("scoreTable");
    const fragment = document.createDocumentFragment();
    const highMark = clamp(selectedMarks + 12, model.minMarks, model.maxMarks);
    const lowMark = clamp(selectedMarks - 12, model.minMarks, model.maxMarks);

    for (let mark = highMark; mark >= lowMark; mark -= 1) {
      const base = rankAt(mark, "air");
      const baseline = rankAt(mark, "baseline");
      const low = rankAt(mark, "low");
      const high = rankAt(mark, "high");
      const row = document.createElement("tr");
      row.className = mark === selectedMarks ? "is-selected" : "";
      row.tabIndex = 0;
      row.innerHTML = `
        <td>${mark}</td>
        <td>${format(base)}</td>
        <td>${format(baseline)}</td>
        <td>${format(low)}–${format(high)}</td>
        <td>${percentile(base).toFixed(2)}%</td>
        <td>${format(localDensity(mark, "air"))}</td>
      `;
      row.addEventListener("click", () => setMarks(mark, { haptic: "soft" }));
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setMarks(mark);
        }
      });
      fragment.appendChild(row);
    }

    body.replaceChildren(fragment);
    $("tableMark").textContent = String(selectedMarks);
  }

  function updateQueue(density) {
    const dots = $("queueDots");
    if (!dots.childElementCount) {
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 70; index += 1) {
        const dot = document.createElement("i");
        dot.style.setProperty("--dot-delay", `${Math.min(520, index * 11)}ms`);
        fragment.appendChild(dot);
      }
      dots.appendChild(fragment);
    }

    const crossed = clamp(Math.round((density / 500) * 70), 5, 66);
    Array.from(dots.children).forEach((dot, index) => dot.classList.toggle("is-crossed", index < crossed));
  }

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function buildChart() {
    const width = 780;
    const height = 350;
    const left = 59;
    const right = 18;
    const top = 18;
    const bottom = 40;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const minRank = 1;
    const maxRank = 150000;
    const x = (mark) => left + ((mark - model.minMarks) / (model.maxMarks - model.minMarks)) * plotWidth;
    const y = (rank) => top + ((Math.log(rank) - Math.log(minRank)) / (Math.log(maxRank) - Math.log(minRank))) * plotHeight;
    const linePath = (key) => {
      const points = [];
      for (let mark = model.minMarks; mark <= model.maxMarks; mark += 1) {
        points.push(`${mark === model.minMarks ? "M" : "L"}${x(mark).toFixed(2)},${y(rankAt(mark, key)).toFixed(2)}`);
      }
      return points.join(" ");
    };

    const fragment = document.createDocumentFragment();
    const title = svgElement("title");
    title.textContent = "Predicted marks to rank curve";
    const description = svgElement("desc");
    description.textContent = "A logarithmic All India Rank axis showing the scenario-weighted prediction and harder-to-easier scenario range from 350 to 650 marks.";
    fragment.append(title, description);

    [10, 100, 1000, 10000, 100000].forEach((rank) => {
      const position = y(rank);
      fragment.appendChild(svgElement("line", { x1: left, y1: position, x2: width - right, y2: position, class: "grid-line" }));
      const label = svgElement("text", { x: left - 9, y: position + 3.5, "text-anchor": "end", class: "axis-label" });
      label.textContent = compactFormat.format(rank);
      fragment.appendChild(label);
    });

    [350, 400, 450, 500, 550, 600, 650].forEach((mark) => {
      const position = x(mark);
      const tick = svgElement("line", { x1: position, y1: height - bottom, x2: position, y2: height - bottom + 5, class: "grid-line" });
      const label = svgElement("text", { x: position, y: height - 15, "text-anchor": "middle", class: "axis-label" });
      label.textContent = String(mark);
      fragment.append(tick, label);
    });

    const axisTitle = svgElement("text", { x: 1, y: 10, class: "axis-title" });
    axisTitle.textContent = "BETTER AIR ↑";
    fragment.appendChild(axisTitle);

    const lowPoints = [];
    const highPoints = [];
    for (let mark = model.minMarks; mark <= model.maxMarks; mark += 1) {
      lowPoints.push(`${x(mark).toFixed(2)},${y(rankAt(mark, "low")).toFixed(2)}`);
      highPoints.unshift(`${x(mark).toFixed(2)},${y(rankAt(mark, "high")).toFixed(2)}`);
    }

    const band = svgElement("polygon", { points: [...lowPoints, ...highPoints].join(" "), class: "uncertainty-band" });
    const baseCurve = svgElement("path", { d: linePath("air"), class: "base-curve" });
    const lensCurve = svgElement("path", { d: linePath("air"), class: "lens-curve" });
    const cursor = svgElement("line", { x1: 0, y1: top, x2: 0, y2: height - bottom, class: "cursor-line" });
    const halo = svgElement("circle", { cx: 0, cy: 0, r: 7, class: "selected-halo" });
    const dot = svgElement("circle", { cx: 0, cy: 0, r: 7, class: "selected-dot" });
    const labelGroup = svgElement("g", { class: "point-label-group" });
    const labelBackground = svgElement("rect", { x: 0, y: 0, width: 83, height: 27, rx: 8, class: "point-label-bg" });
    const labelText = svgElement("text", { x: 0, y: 0, class: "point-label" });
    labelGroup.append(labelBackground, labelText);

    const overlay = svgElement("rect", {
      x: left,
      y: top,
      width: plotWidth,
      height: plotHeight,
      fill: "transparent",
      "aria-hidden": "true"
    });

    fragment.append(band, baseCurve, lensCurve, cursor, halo, dot, labelGroup, overlay);
    chart.replaceChildren(fragment);

    Object.assign(chartState, {
      width,
      height,
      left,
      right,
      top,
      bottom,
      plotWidth,
      plotHeight,
      x,
      y,
      linePath,
      lensCurve,
      cursor,
      halo,
      dot,
      labelGroup,
      labelBackground,
      labelText,
      overlay
    });

    const updateFromPointer = (event) => {
      const point = chart.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const matrix = chart.getScreenCTM();
      if (!matrix) return;
      const local = point.matrixTransform(matrix.inverse());
      const ratio = clamp((local.x - left) / plotWidth, 0, 1);
      setMarks(model.minMarks + ratio * (model.maxMarks - model.minMarks));
    };

    overlay.addEventListener("pointerdown", (event) => {
      draggingChart = true;
      haptic("soft");
      overlay.setPointerCapture(event.pointerId);
      updateFromPointer(event);
    });
    overlay.addEventListener("pointermove", (event) => {
      if (draggingChart) updateFromPointer(event);
    });
    overlay.addEventListener("pointerup", (event) => {
      draggingChart = false;
      if (overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId);
    });
    overlay.addEventListener("pointercancel", () => { draggingChart = false; });

    chart.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        setMarks(selectedMarks - 1);
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        setMarks(selectedMarks + 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        setMarks(model.minMarks);
      } else if (event.key === "End") {
        event.preventDefault();
        setMarks(model.maxMarks);
      }
    });
  }

  function updateChart(result, key, color) {
    if (!chartState.dot) return;
    const x = chartState.x(selectedMarks);
    const y = chartState.y(result);
    const useLeftLabel = x > chartState.width - 120;
    const labelX = useLeftLabel ? x - 91 : x + 9;
    const labelY = clamp(y - 36, chartState.top + 2, chartState.height - chartState.bottom - 32);

    chartState.cursor.setAttribute("x1", x);
    chartState.cursor.setAttribute("x2", x);
    chartState.dot.setAttribute("cx", x);
    chartState.dot.setAttribute("cy", y);
    chartState.dot.style.fill = color;
    chartState.halo.setAttribute("cx", x);
    chartState.halo.setAttribute("cy", y);
    chartState.halo.style.stroke = color;
    chartState.labelBackground.setAttribute("x", labelX);
    chartState.labelBackground.setAttribute("y", labelY);
    chartState.labelText.setAttribute("x", labelX + 10);
    chartState.labelText.setAttribute("y", labelY + 17);
    chartState.labelText.textContent = `${selectedMarks} · ${compactFormat.format(Math.round(result))}`;

    chartState.lensCurve.setAttribute("d", chartState.linePath(key));
    chartState.lensCurve.style.stroke = color;
    chartState.lensCurve.classList.toggle("is-visible", key !== "air");
    chart.setAttribute("aria-label", `${selectedMarks} marks gives a ${model.lenses[selectedLens].label.toLowerCase()} of AIR ${format(result)}. The scenario-weighted AIR is ${format(rankAt(selectedMarks, "air"))}, with a scenario range from ${format(rankAt(selectedMarks, "low"))} to ${format(rankAt(selectedMarks, "high"))}.`);
  }

  function render() {
    const lens = model.lenses[selectedLens];
    const key = lens.key;
    const result = rankAt(selectedMarks, key);
    const weighted = rankAt(selectedMarks, "air");
    const baseline = rankAt(selectedMarks, "baseline");
    const low = rankAt(selectedMarks, "low");
    const high = rankAt(selectedMarks, "high");
    const density = localDensity(selectedMarks, key);
    const mood = moodFor(result);

    marksInput.value = String(selectedMarks);
    marksRange.value = String(selectedMarks);
    marksRange.style.setProperty("--slider-progress", `${((selectedMarks - model.minMarks) / (model.maxMarks - model.minMarks)) * 100}%`);

    animateRank(result);
    $("rangeLow").textContent = format(low);
    $("rangeHigh").textContent = format(high);
    $("selectedMarksKpi").textContent = `${selectedMarks} /720`;
    $("weightedKpi").textContent = format(weighted);
    $("baselineKpi").textContent = format(baseline);
    $("pctKpi").textContent = `${percentile(result).toFixed(2)}%`;
    $("densityKpi").textContent = format(density);
    $("shareKpi").textContent = `${((selectedMarks / model.totalMarks) * 100).toFixed(1)}%`;
    $("lensName").textContent = lens.label;
    $("lensNote").textContent = lens.note;
    $("lensDot").style.background = lens.color;
    $("lensDot").style.boxShadow = `0 0 0 4px ${lens.color}18`;
    const markerPosition = high === low ? 50 : clamp(((result - low) / (high - low)) * 100, 0, 100);
    $("rangeMarker").style.left = `${markerPosition}%`;
    $("rangeMarker").style.background = lens.color;
    $("rangeMarker").style.boxShadow = `0 0 0 1px ${lens.color}`;
    $("rankMoodText").textContent = mood.copy;
    $("rankMood").dataset.tier = mood.tier;
    $("rangeNudge").textContent = `One mark here moves roughly ${format(density)} people. Tiny mark, rude consequence.`;
    document.documentElement.style.setProperty("--mood-rgb", mood.color);
    document.querySelector(".result-panel").dataset.mood = mood.tier;

    $("storyMark").textContent = String(selectedMarks);
    $("storyDensity").textContent = `${format(localDensity(selectedMarks, "air"))} candidates per mark`;
    $("dynamicWhy").textContent = `${selectedMarks} can model near weighted AIR ${format(weighted)}—and still miss.`;
    $("activeLegend").textContent = selectedLens === "weighted" ? "Weighted selected" : lens.label;

    renderRecall(weighted, "air");
    renderTable();
    updateQueue(localDensity(selectedMarks, "air"));
    updateChart(result, key, lens.color);
  }

  marksRange.addEventListener("input", (event) => {
    const next = Number(event.target.value);
    if (Math.abs(next - lastSliderHaptic) >= 5) {
      haptic("soft");
      lastSliderHaptic = next;
    }
    setMarks(next);
  });
  marksInput.addEventListener("input", (event) => {
    if (event.target.value !== "") setMarks(event.target.value);
  });
  marksInput.addEventListener("blur", () => {
    if (marksInput.value === "" || !Number.isFinite(Number(marksInput.value))) marksInput.value = String(selectedMarks);
  });
  $("stepDown").addEventListener("click", () => setMarks(selectedMarks - 1, { haptic: "tap" }));
  $("stepUp").addEventListener("click", () => setMarks(selectedMarks + 1, { haptic: "tap" }));

  document.querySelectorAll(".quick-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.mark) {
        setMarks(button.dataset.mark, { haptic: "select", quip: "Back to 508. The original plot." });
        return;
      }

      const delta = Number(button.dataset.delta || 0);
      const improving = delta > 0;
      setMarks(selectedMarks + delta, {
        haptic: Math.abs(delta) >= 10 && improving ? "celebrate" : improving ? "success" : "tap",
        celebrate: improving,
        quip: improving
          ? (Math.abs(delta) >= 10 ? "Two recall flips. Now that is a glow-up." : "Five marks. Quietly doing loud things.")
          : (Math.abs(delta) >= 10 ? "Worst-case audition complete. You are still here." : "Stress test logged. Doom-scroll denied.")
      });
    });
  });

  document.querySelectorAll("[data-lens]").forEach((button) => {
    button.addEventListener("click", () => setLens(button.dataset.lens, { feedback: true }));
  });

  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  });

  const dialog = $("helpDialog");
  const openDialog = () => {
    haptic("select");
    showModal(dialog);
  };
  const closeDialog = () => {
    haptic("soft");
    closeModal(dialog);
  };
  $("helpOpen").addEventListener("click", openDialog);
  $("helpClose").addEventListener("click", closeDialog);
  $("helpDone").addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) closeDialog();
  });

  document.querySelectorAll("details > summary").forEach((summary) => {
    summary.addEventListener("click", () => haptic("soft"));
  });

  document.addEventListener("pointerdown", createTapEcho, { passive: true });
  if (finePointer.matches && !reduceMotion.matches) {
    document.addEventListener("pointermove", (event) => {
      document.documentElement.style.setProperty("--pointer-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--pointer-y", `${event.clientY}px`);
    }, { passive: true });
  }

  const topbar = document.querySelector(".topbar");
  const updateTopbar = () => topbar.classList.toggle("is-scrolled", window.scrollY > 10);
  window.addEventListener("scroll", updateTopbar, { passive: true });
  updateTopbar();

  const revealItems = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  lensSwitch.dataset.index = "0";
  setupAnswerCalculator();
  setupInstallExperience();
  setupBootSequence();
  commitTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark", false);
  setupMagneticSurfaces();
  buildChart();
  render();
})();
