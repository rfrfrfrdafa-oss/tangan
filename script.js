const DEFAULT_MODEL_URL = "";
const CONFIDENCE_THRESHOLD = 0.60;
const SMOOTHING_WINDOW = 8;

let model = null;
let webcam = null;
let maxPredictions = 0;
let animationId = null;
let predicting = false;
let roundRunning = false;
let latestDetection = null;
let predictionHistory = [];
let scores = { player: 0, ai: 0 };

const $ = (selector) => document.querySelector(selector);

const modelUrlInput = $("#modelUrl");
const loadModelBtn = $("#loadModelBtn");
const cameraBtn = $("#cameraBtn");
const playBtn = $("#playBtn");
const resetBtn = $("#resetBtn");
const webcamContainer = $("#webcam-container");
const modelStatus = $("#modelStatus");
const cameraState = $("#cameraState");
const liveGesture = $("#liveGesture");
const confidenceChip = $("#confidenceChip");
const probabilities = $("#probabilities");
const countdown = $("#countdown");
const resultText = $("#resultText");
const resultDetail = $("#resultDetail");
const playerMove = $("#playerMove");
const aiMove = $("#aiMove");
const playerIcon = $("#playerIcon");
const aiIcon = $("#aiIcon");
const playerScore = $("#playerScore");
const aiScore = $("#aiScore");
const playerCard = $("#playerCard");
const aiCard = $("#aiCard");
const vsBadge = $("#vsBadge");

const GESTURES = {
  batu: { id: "batu", label: "Batu", icon: "✊" },
  gunting: { id: "gunting", label: "Gunting", icon: "✌️" },
  kertas: { id: "kertas", label: "Kertas", icon: "✋" },
};

function normalizeModelUrl(url) {
  return url.trim().replace(/\/+$/, "") + "/";
}

function mapClassName(name) {
  const value = String(name).trim().toLowerCase();
  if (value.includes("batu") || value.includes("rock")) return "batu";
  if (value.includes("gunting") || value.includes("scissor")) return "gunting";
  if (value.includes("kertas") || value.includes("paper")) return "kertas";
  return null;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function setModelStatus(text, kind = "normal") {
  modelStatus.textContent = text;
  modelStatus.style.color = kind === "good" ? "#9fe9cf" : kind === "error" ? "#fda4af" : "";
}

function showMessage(title, detail) {
  resultText.textContent = title;
  resultDetail.textContent = detail;
}

function ensureRequiredModelLabels() {
  const labels = typeof model.getClassLabels === "function" ? model.getClassLabels() : [];
  const mapped = new Set(labels.map(mapClassName).filter(Boolean));
  return {
    valid: ["batu", "gunting", "kertas"].every((gesture) => mapped.has(gesture)),
    labels,
  };
}

async function loadModel() {
  const rawUrl = modelUrlInput.value || DEFAULT_MODEL_URL;
  if (!rawUrl) {
    setModelStatus("Masukkan URL model", "error");
    showMessage("URL model belum ada.", "Tempel URL model Teachable Machine lalu tekan “Muat Model”.");
    modelUrlInput.focus();
    return;
  }

  const url = normalizeModelUrl(rawUrl);
  if (!/^https:\/\//i.test(url)) {
    setModelStatus("URL harus HTTPS", "error");
    showMessage("URL tidak valid.", "Gunakan URL https:// dari panel export Teachable Machine.");
    return;
  }

  loadModelBtn.disabled = true;
  loadModelBtn.textContent = "Memuat…";
  setModelStatus("Memuat model…");
  showMessage("Sedang memuat model.", "Browser sedang mengambil model.json dan metadata.json.");

  try {
    const modelURL = `${url}model.json`;
    const metadataURL = `${url}metadata.json`;

    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    const check = ensureRequiredModelLabels();
    if (!check.valid || maxPredictions < 3) {
      throw new Error(`Kelas model tidak cocok. Ditemukan: ${check.labels.join(", ") || "tidak diketahui"}`);
    }

    localStorage.setItem("aiRpsModelUrl", url);
    setModelStatus(`${maxPredictions} kelas siap`, "good");
    playBtn.disabled = !webcam;
    cameraBtn.disabled = false;
    showMessage("Model siap.", "Mulai kamera lalu pastikan tangan terlihat jelas di dalam kotak.");
  } catch (error) {
    console.error(error);
    model = null;
    maxPredictions = 0;
    setModelStatus("Gagal memuat model", "error");
    showMessage("Model gagal dimuat.", error?.message || "Periksa URL model dan koneksi internet.");
  } finally {
    loadModelBtn.disabled = false;
    loadModelBtn.textContent = "Muat Model";
  }
}

async function startCamera() {
  if (!model) {
    showMessage("Muat model terlebih dahulu.", "URL model belum berhasil dimuat.");
    return;
  }

  if (webcam) {
    stopCamera();
  }

  cameraBtn.disabled = true;
  cameraBtn.textContent = "Menyalakan…";

  try {
    webcam = new tmImage.Webcam(360, 360, true);
    await webcam.setup();
    await webcam.play();

    webcamContainer.innerHTML = "";
    webcamContainer.appendChild(webcam.canvas);
    cameraState.textContent = "LIVE";
    cameraState.classList.add("active");
    cameraBtn.textContent = "Matikan Kamera";
    cameraBtn.disabled = false;
    playBtn.disabled = false;
    predictionHistory = [];

    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(predictionLoop);
  } catch (error) {
    console.error(error);
    webcam = null;
    cameraState.textContent = "OFFLINE";
    cameraState.classList.remove("active");
    cameraBtn.textContent = "Mulai Kamera";
    cameraBtn.disabled = false;
    playBtn.disabled = true;
    showMessage(
      "Kamera tidak bisa dibuka.",
      "Izinkan akses kamera di browser. GitHub Pages menyediakan HTTPS sehingga webcam bisa digunakan."
    );
  }
}

function stopCamera() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (webcam) {
    try { webcam.stop(); } catch (error) { console.warn(error); }
    webcam = null;
  }

  predicting = false;
  cameraState.textContent = "OFFLINE";
  cameraState.classList.remove("active");
  cameraBtn.textContent = "Mulai Kamera";
  cameraBtn.disabled = !model;
  playBtn.disabled = true;
  liveGesture.textContent = "—";
  confidenceChip.textContent = "—";
  predictionHistory = [];

  webcamContainer.innerHTML = `
    <div class="camera-placeholder">
      <div class="camera-icon">◉</div>
      <strong>Kamera belum aktif</strong>
      <span>Muat model lalu mulai kamera.</span>
    </div>
  `;
}

function addToHistory(predictions) {
  predictionHistory.push(predictions);
  if (predictionHistory.length > SMOOTHING_WINDOW) predictionHistory.shift();
}

function getSmoothedPredictions() {
  if (!predictionHistory.length) return [];

  return predictionHistory[0].map((item, index) => {
    const total = predictionHistory.reduce((sum, frame) => sum + (frame[index]?.probability || 0), 0);
    return {
      className: item.className,
      probability: total / predictionHistory.length,
    };
  });
}

function getBestDetection(predictions) {
  if (!predictions.length) return null;
  const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
  const top = sorted[0];
  return {
    rawLabel: top.className,
    gesture: mapClassName(top.className),
    probability: top.probability,
  };
}

function renderProbabilities(predictions) {
  const byGesture = { batu: 0, gunting: 0, kertas: 0 };
  predictions.forEach((item) => {
    const gesture = mapClassName(item.className);
    if (gesture) byGesture[gesture] = item.probability;
  });

  probabilities.innerHTML = Object.values(GESTURES).map((item) => `
    <div class="probability">
      <span>${item.label}</span>
      <div class="probability-track">
        <div class="probability-fill" style="width:${byGesture[item.id] * 100}%"></div>
      </div>
      <strong>${formatPercent(byGesture[item.id])}</strong>
    </div>
  `).join("");
}

async function predictionLoop() {
  if (!webcam || !model || predicting) {
    animationId = requestAnimationFrame(predictionLoop);
    return;
  }

  predicting = true;
  try {
    webcam.update();
    const predictions = await model.predict(webcam.canvas);
    addToHistory(predictions);

    const smoothed = getSmoothedPredictions();
    const detection = getBestDetection(smoothed);
    latestDetection = detection;

    if (detection) {
      const visibleLabel = detection.gesture ? GESTURES[detection.gesture].label : detection.rawLabel;
      liveGesture.textContent = detection.gesture && detection.probability >= CONFIDENCE_THRESHOLD ? visibleLabel : "Tidak yakin";
      confidenceChip.textContent = `${formatPercent(detection.probability)} yakin`;
    }

    renderProbabilities(smoothed);
  } catch (error) {
    console.error("Prediction error:", error);
  } finally {
    predicting = false;
    animationId = requestAnimationFrame(predictionLoop);
  }
}

function randomGesture() {
  const keys = Object.keys(GESTURES);
  return keys[Math.floor(Math.random() * keys.length)];
}

function determineWinner(player, ai) {
  if (player === ai) return "draw";
  if (
    (player === "batu" && ai === "gunting") ||
    (player === "gunting" && ai === "kertas") ||
    (player === "kertas" && ai === "batu")
  ) return "player";
  return "ai";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playRound() {
  if (roundRunning) return;
  if (!model || !webcam) {
    showMessage("Kamera belum siap.", "Muat model dan aktifkan kamera terlebih dahulu.");
    return;
  }

  roundRunning = true;
  playBtn.disabled = true;
  loadModelBtn.disabled = true;
  cameraBtn.disabled = true;
  predictionHistory = [];
  latestDetection = null;

  playerMove.textContent = "Siap…";
  aiMove.textContent = "Siap…";
  playerIcon.textContent = "👀";
  aiIcon.textContent = "🤖";
  showMessage("Bersiap!", "Tunjukkan satu gerakan tangan dan tahan sampai hitungan selesai.");

  for (const number of [3, 2, 1]) {
    countdown.textContent = number;
    await wait(700);
  }
  countdown.textContent = "GO!";
  await wait(350);
  countdown.textContent = "";

  // Use the newest stabilized prediction after the countdown.
  const detection = latestDetection;
  if (!detection?.gesture || detection.probability < CONFIDENCE_THRESHOLD) {
    showMessage("Belum terbaca dengan jelas.", `Coba lagi dengan tangan lebih dekat dan latar yang lebih sederhana (minimal ${Math.round(CONFIDENCE_THRESHOLD * 100)}%).`);
    playerMove.textContent = "Coba lagi";
    aiMove.textContent = "—";
    playerIcon.textContent = "?";
    aiIcon.textContent = "?";
    restoreControls();
    return;
  }

  const player = detection.gesture;
  const ai = randomGesture();
  const result = determineWinner(player, ai);

  playerIcon.textContent = GESTURES[player].icon;
  playerMove.textContent = GESTURES[player].label;
  aiIcon.textContent = GESTURES[ai].icon;
  aiMove.textContent = GESTURES[ai].label;

  playerCard.classList.add("flash");
  aiCard.classList.add("flash");
  vsBadge.textContent = "•";
  await wait(220);
  playerCard.classList.remove("flash");
  aiCard.classList.remove("flash");
  vsBadge.textContent = "VS";

  if (result === "player") {
    scores.player += 1;
    showMessage("Kamu menang!", `${GESTURES[player].label} mengalahkan ${GESTURES[ai].label}.`);
  } else if (result === "ai") {
    scores.ai += 1;
    showMessage("AI menang!", `${GESTURES[ai].label} mengalahkan ${GESTURES[player].label}.`);
  } else {
    showMessage("Seri!", `Kalian sama-sama memilih ${GESTURES[player].label}.`);
  }

  updateScores();
  restoreControls();
}

function restoreControls() {
  roundRunning = false;
  playBtn.disabled = !webcam || !model;
  loadModelBtn.disabled = false;
  cameraBtn.disabled = !model;
}

function updateScores() {
  playerScore.textContent = scores.player;
  aiScore.textContent = scores.ai;
}

function resetGame() {
  scores = { player: 0, ai: 0 };
  updateScores();
  playerMove.textContent = "Belum main";
  aiMove.textContent = "Menunggu";
  playerIcon.textContent = "?";
  aiIcon.textContent = "?";
  countdown.textContent = "";
  showMessage(
    model ? "Siap bermain." : "Muat model untuk mulai.",
    model ? "Aktifkan kamera lalu tekan “Main Sekarang”." : "Tempel URL model Teachable Machine di atas."
  );
}

loadModelBtn.addEventListener("click", loadModel);
cameraBtn.addEventListener("click", () => webcam ? stopCamera() : startCamera());
playBtn.addEventListener("click", playRound);
resetBtn.addEventListener("click", resetGame);

modelUrlInput.value = localStorage.getItem("aiRpsModelUrl") || DEFAULT_MODEL_URL;
updateScores();
