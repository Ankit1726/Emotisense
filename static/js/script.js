// ============================================================
// EmotiSense — front-end logic
// ============================================================

const EMOTIONS = [
  { label: "sadness", emoji: "😢", color: "#5B8DEF" },
  { label: "joy", emoji: "😄", color: "#FFC145" },
  { label: "love", emoji: "💜", color: "#C77DFF" },
  { label: "anger", emoji: "😠", color: "#FF5D5D" },
  { label: "fear", emoji: "😨", color: "#3DDC97" },
  { label: "surprise", emoji: "😲", color: "#FF9F5A" },
];

/* ---------------- Ambient particle background ---------------- */
(function ambientBackground() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w, h, particles;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function makeParticles() {
    const count = Math.min(60, Math.floor((w * h) / 26000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      hueColor: Math.random() > 0.5 ? "76,224,210" : "199,125,255",
      alpha: Math.random() * 0.35 + 0.08,
    }));
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.hueColor},${p.alpha})`;
      ctx.fill();
    });
    if (!reduceMotion) requestAnimationFrame(tick);
  }

  resize();
  makeParticles();
  tick();
  window.addEventListener("resize", () => {
    resize();
    makeParticles();
  });
})();

/* ---------------- Hero waveform (idle neural pulse) ---------------- */
(function heroWave() {
  const canvas = document.getElementById("wave-canvas");
  const legend = document.getElementById("hero-legend");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  legend.innerHTML = EMOTIONS.map(
    (e) =>
      `<span class="legend-item"><span class="legend-swatch" style="background:${e.color}"></span>${e.label}</span>`,
  ).join("");

  let w,
    h,
    t = 0;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    w = rect.width;
    h = rect.height;
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    EMOTIONS.forEach((e, i) => {
      ctx.beginPath();
      const amp = 14 + i * 3;
      const freq = 0.018 + i * 0.003;
      const phase = t * (0.02 + i * 0.006) + i;
      for (let x = 0; x <= w; x += 4) {
        const y =
          mid + Math.sin(x * freq + phase) * amp * Math.sin(t * 0.01 + i);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    t += 1;
    if (!reduceMotion) requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", resize);
})();

/* ---------------- Demo: predict flow ---------------- */
(function demo() {
  const textInput = document.getElementById("text-input");
  const charCount = document.getElementById("char-count");
  const analyzeBtn = document.getElementById("analyze-btn");
  const analyzeBtnText = document.getElementById("analyze-btn-text");
  const spinner = document.getElementById("analyze-spinner");
  const errorMsg = document.getElementById("error-msg");

  const resultEmpty = document.getElementById("result-empty");
  const resultContent = document.getElementById("result-content");
  const topEmoji = document.getElementById("top-emoji");
  const topLabel = document.getElementById("top-label");
  const topProb = document.getElementById("top-prob");
  const latency = document.getElementById("latency");
  const resultBars = document.getElementById("result-bars");
  const tokenCount = document.getElementById("token-count");
  const vocabCoverage = document.getElementById("vocab-coverage");

  function updateCharCount() {
    charCount.textContent = `${textInput.value.length} / 2000`;
  }
  textInput.addEventListener("input", updateCharCount);
  updateCharCount();

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      textInput.value = chip.dataset.text;
      updateCharCount();
      textInput.focus();
      analyze();
    });
  });

  textInput.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") analyze();
  });

  analyzeBtn.addEventListener("click", analyze);

  function setLoading(loading) {
    analyzeBtn.disabled = loading;
    spinner.hidden = !loading;
    analyzeBtnText.textContent = loading ? "Analyzing…" : "Analyze emotion";
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.hidden = false;
  }
  function clearError() {
    errorMsg.hidden = true;
  }

  async function analyze() {
    const text = textInput.value.trim();
    clearError();
    if (!text) {
      showError("Type something first — even a short sentence works.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || "Something went wrong. Please try again.");
        return;
      }
      renderResult(data);
    } catch (err) {
      showError("Couldn't reach the model server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  function renderResult(data) {
    resultEmpty.hidden = true;
    resultContent.hidden = false;
    // retrigger entrance animation
    resultContent.style.animation = "none";
    void resultContent.offsetWidth;
    resultContent.style.animation = "";

    const top = data.top;
    topEmoji.textContent = top.emoji;
    topLabel.textContent = top.label;
    topProb.textContent = `${Math.round(top.probability * 100)}%`;
    latency.textContent = `${data.latency_ms}ms`;
    tokenCount.textContent = data.token_count;
    vocabCoverage.textContent = `${Math.round(data.vocab_coverage * 100)}%`;

    resultBars.innerHTML = data.distribution
      .map(
        (d) => `
      <div class="bar-row">
        <span class="bar-row-label">${d.emoji} ${d.label}</span>
        <span class="bar-track"><span class="bar-fill" data-width="${d.probability * 100}" style="background:${d.color}"></span></span>
        <span class="bar-row-pct">${Math.round(d.probability * 100)}%</span>
      </div>`,
      )
      .join("");

    // animate bar widths after paint
    requestAnimationFrame(() => {
      resultBars.querySelectorAll(".bar-fill").forEach((el) => {
        el.style.width = `${el.dataset.width}%`;
      });
    });
  }
})();

/* ---------------- Reveal-on-scroll for pipeline / sections ---------------- */
(function revealOnScroll() {
  const targets = document.querySelectorAll(".pipe-stage");
  if (!("IntersectionObserver" in window) || !targets.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = "running";
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 },
  );
  targets.forEach((t) => io.observe(t));
})();
