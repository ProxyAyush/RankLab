(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const themeToggle = document.getElementById("themeToggle");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const feedbackForm = document.getElementById("feedbackForm");
  const feedbackMessage = document.getElementById("feedbackMessage");
  const feedbackCount = document.getElementById("feedbackCount");
  const feedbackStatus = document.getElementById("feedbackStatus");
  const copyFeedback = document.getElementById("copyFeedback");
  const destination = "Ayushiamazon1@gmail.com";

  function haptic(pattern = 8) {
    if (reduceMotion.matches || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(pattern);
  }

  function themeCopy(theme) {
    return theme === "light"
      ? { label: "Switch to night mode", color: "#f4f7f6" }
      : { label: "Switch to day mode", color: "#070b0c" };
  }

  function commitTheme(theme, remember = true) {
    const next = theme === "light" ? "light" : "dark";
    const copy = themeCopy(next);
    document.documentElement.dataset.theme = next;
    themeToggle?.setAttribute("aria-label", copy.label);
    themeToggle?.setAttribute("aria-pressed", String(next === "light"));
    if (themeMeta) themeMeta.setAttribute("content", copy.color);
    if (remember) {
      try { localStorage.setItem("ranklab-theme", next); } catch (_) { /* preferences are optional */ }
    }
  }

  if (themeToggle) {
    commitTheme(document.documentElement.dataset.theme, false);
    themeToggle.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      commitTheme(next);
      haptic(12);
    });
  }

  const topbar = document.querySelector(".topbar");
  if (topbar) {
    const updateTopbar = () => topbar.classList.toggle("is-scrolled", window.scrollY > 10);
    window.addEventListener("scroll", updateTopbar, { passive: true });
    updateTopbar();
  }

  function feedbackText() {
    if (!feedbackForm) return "";
    const data = new FormData(feedbackForm);
    const category = String(data.get("category") || "General feedback");
    const vibe = String(data.get("vibe") || "Not selected");
    const message = String(data.get("message") || "").trim();
    return [
      "RankLab feedback",
      "",
      `Category: ${category}`,
      `Overall vibe: ${vibe}`,
      "",
      message,
      "",
      `Page: ${location.origin}${location.pathname.replace(/feedback\.html$/, "")}`
    ].join("\n");
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const helper = document.createElement("textarea");
    helper.value = value;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }

  if (feedbackMessage && feedbackCount) {
    const updateCount = () => { feedbackCount.textContent = `${feedbackMessage.value.length} / 2,000`; };
    feedbackMessage.addEventListener("input", updateCount);
    updateCount();
  }

  if (feedbackForm) {
    feedbackForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!feedbackForm.reportValidity()) return;

      const data = new FormData(feedbackForm);
      const category = String(data.get("category") || "General feedback");
      const subject = `RankLab feedback · ${category}`;
      const mailto = `mailto:${destination}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(feedbackText())}`;
      feedbackStatus.textContent = "Opening your email app. Nothing has been sent yet—you stay in control.";
      haptic([10, 28, 14]);
      window.location.href = mailto;
    });
  }

  if (copyFeedback) {
    copyFeedback.addEventListener("click", async () => {
      if (!feedbackForm?.reportValidity()) return;
      try {
        await copyText(feedbackText());
        feedbackStatus.textContent = "Copied. Paste it wherever you prefer.";
        copyFeedback.textContent = "Copied ✓";
        haptic(12);
        window.setTimeout(() => { copyFeedback.textContent = "Copy instead"; }, 1800);
      } catch (_) {
        feedbackStatus.textContent = "Copy was blocked by the browser. Select the text and copy it manually.";
      }
    });
  }
})();
