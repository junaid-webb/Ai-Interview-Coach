// Pro Frontend with history + PDF export + animations
let questions = [];
let idx = 0;
let scores = { clarity: 0, confidence: 0, keywords: 0 };
let timer = null, seconds = 0;
let recognition = null;
const total = 5;
let answers = [];
let perQuestionFeedback = [];

const roleSelect = document.getElementById("roleSelect");
const difficultySelect = document.getElementById("difficultySelect");
const startBtn = document.getElementById("startBtn");
const questionBox = document.getElementById("questionBox");
const answerInput = document.getElementById("answerInput");
const voiceBtn = document.getElementById("voiceBtn");
const stopVoiceBtn = document.getElementById("stopVoiceBtn");
const nextBtn = document.getElementById("nextBtn");
const feedbackBox = document.getElementById("feedbackBox");
const resultBox = document.getElementById("resultBox");
const progressWrap = document.getElementById("progressWrap");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const timerText = document.getElementById("timerText");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

function loadHistory() {
  const data = JSON.parse(localStorage.getItem("aiprep_history") || "[]");
  historyList.innerHTML = "";
  if (data.length === 0) {
    historyList.innerHTML = `<p class="text-gray-600">No sessions yet.</p>`;
    return;
  }
  data.slice().reverse().forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "p-3 rounded-lg border bg-white/70";
    const dt = new Date(s.timestamp).toLocaleString();
    div.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <div class="font-semibold">${s.role} • ${s.difficulty}</div>
          <div class="text-gray-600">${dt}</div>
          <div>Overall: <b>${s.overall}/5</b> (C:${s.avgClarity} Co:${s.avgConfidence} K:${s.avgKeywords})</div>
        </div>
        <div class="flex gap-2">
          <button data-id="${s.id}" class="dlBtn text-xs px-2 py-1 bg-indigo-600 text-white rounded">PDF</button>
          <button data-id="${s.id}" class="viewBtn text-xs px-2 py-1 bg-gray-700 text-white rounded">View</button>
        </div>
      </div>
    `;
    historyList.appendChild(div);
  });

  // bind download/view
  historyList.querySelectorAll(".dlBtn").forEach(btn => {
    btn.onclick = () => downloadPdf(btn.getAttribute("data-id"));
  });
  historyList.querySelectorAll(".viewBtn").forEach(btn => {
    btn.onclick = () => viewSession(btn.getAttribute("data-id"));
  });
}

function getHistory() {
  return JSON.parse(localStorage.getItem("aiprep_history") || "[]");
}
function setHistory(arr) {
  localStorage.setItem("aiprep_history", JSON.stringify(arr));
}

clearHistoryBtn.onclick = () => {
  if (confirm("Clear all saved sessions?")) {
    localStorage.removeItem("aiprep_history");
    loadHistory();
  }
};

function saveSession(payload) {
  const arr = getHistory();
  arr.push(payload);
  setHistory(arr);
  loadHistory();
}

function viewSession(id) {
  const s = getHistory().find(x => x.id === id);
  if (!s) return;
  resultBox.innerHTML = `
    <h2 class="text-lg font-bold mb-2">Session Details</h2>
    <p><b>Role:</b> ${s.role} • <b>Difficulty:</b> ${s.difficulty}</p>
    <p class="text-gray-600">${new Date(s.timestamp).toLocaleString()}</p>
    <div class="mt-3 space-y-2">
      ${s.questions.map((q, i) => `
        <div class="p-3 bg-white/70 rounded border">
          <div class="font-semibold">${i+1}. ${q}</div>
          <div class="mt-1"><b>Your Answer:</b> ${s.answers[i] || "(empty)"}</div>
          <div class="text-sm mt-1">Feedback — C:${s.feedback[i]?.clarity}/5, Co:${s.feedback[i]?.confidence}/5, K:${s.feedback[i]?.keywords}/5</div>
          <div class="text-xs text-gray-700">${s.feedback[i]?.tip || ""}</div>
        </div>
      `).join("")}
    </div>
    <div class="mt-3">
      <div>Final — C:${s.avgClarity}/5, Co:${s.avgConfidence}/5, K:${s.avgKeywords}/5, <b>Overall:${s.overall}/5</b></div>
      <button class="mt-3 px-3 py-2 bg-indigo-600 text-white rounded" onclick="downloadPdf('${s.id}')">Download PDF</button>
    </div>
  `;
  resultBox.classList.remove("hidden");
  resultBox.scrollIntoView({ behavior: "smooth" });
}

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  const role = roleSelect.value;
  const difficulty = difficultySelect.value;
  try {
    const res = await fetch(`${API_BASE}/api/questions?role=${encodeURIComponent(role)}&difficulty=${encodeURIComponent(difficulty)}`);
    questions = await res.json();
    idx = 0;
    answers = Array(questions.length).fill("");
    perQuestionFeedback = [];
    scores = { clarity: 0, confidence: 0, keywords: 0 };
    resultBox.classList.add("hidden");
    showQuestion();
  } catch (e) {
    alert("Could not fetch questions. Make sure the backend is running on http://localhost:3000");
    startBtn.disabled = false;
  }
});

nextBtn.addEventListener("click", async () => {
  answers[idx] = answerInput.value;
  await sendFeedback();
  idx++;
  if (idx < total) {
    showQuestion();
  } else {
    showResult();
  }
});

function showQuestion() {
  progressWrap.classList.remove("hidden");
  questionBox.classList.remove("hidden");
  answerInput.classList.remove("hidden");
  voiceBtn.classList.remove("hidden");
  stopVoiceBtn.classList.remove("hidden");
  nextBtn.classList.remove("hidden");
  feedbackBox.classList.add("hidden");
  questionBox.textContent = questions[idx];
  answerInput.value = answers[idx] || "";
  updateProgress();
  resetTimer();
  startTimer();
  // subtle animation
  questionBox.classList.remove("fadeUp"); void questionBox.offsetWidth; questionBox.classList.add("fadeUp");
}

function updateProgress() {
  progressText.textContent = `Question ${idx+1}/${total}`;
  const pct = ((idx) / total) * 100;
  progressBar.style.width = `${pct}%`;
}

function startTimer() {
  seconds = 0;
  timer = setInterval(() => {
    seconds++;
    const mm = String(Math.floor(seconds/60)).padStart(2, '0');
    const ss = String(seconds%60).padStart(2, '0');
    timerText.textContent = `Time: ${mm}:${ss}`;
  }, 1000);
}
function resetTimer() {
  if (timer) clearInterval(timer);
  timerText.textContent = "Time: 00:00";
}

// Voice input
voiceBtn.addEventListener("click", () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return alert("Speech Recognition not supported in this browser.");
  recognition = new SR();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.start();
  voiceBtn.disabled = true;
  recognition.onresult = (e) => {
    let transcript = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    answerInput.value = transcript.trim();
  };
  recognition.onerror = () => { voiceBtn.disabled = false; };
});

stopVoiceBtn.addEventListener("click", () => {
  if (recognition) {
    recognition.stop();
    voiceBtn.disabled = false;
  }
});

async function sendFeedback() {
  try {
    const res = await fetch(`${API_BASE}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: roleSelect.value,
        difficulty: difficultySelect.value,
        question: questions[idx],
        answer: answerInput.value
      })
    });
    const fb = await res.json();
    perQuestionFeedback[idx] = fb;
    scores.clarity += fb.clarity;
    scores.confidence += fb.confidence;
    scores.keywords += fb.keywords;
    feedbackBox.innerHTML = `
      <p><b>Feedback:</b></p>
      <p>Clarity: ${fb.clarity}/5</p>
      <p>Confidence: ${fb.confidence}/5</p>
      <p>Keyword Coverage: ${fb.keywords}/5</p>
      <p class="mt-2 text-sm text-gray-700">${fb.tip || ""}</p>
    `;
    feedbackBox.classList.remove("hidden");
    feedbackBox.classList.remove("fadeUp"); void feedbackBox.offsetWidth; feedbackBox.classList.add("fadeUp");
  } catch (e) {
    feedbackBox.textContent = "Couldn't get feedback. Is the backend running?";
    feedbackBox.classList.remove("hidden");
  }
}

function showResult() {
  resetTimer();
  questionBox.classList.add("hidden");
  answerInput.classList.add("hidden");
  voiceBtn.classList.add("hidden");
  stopVoiceBtn.classList.add("hidden");
  nextBtn.classList.add("hidden");
  feedbackBox.classList.add("hidden");
  progressBar.style.width = "100%";
  progressText.textContent = "Completed";
  const avgC = (scores.clarity/total).toFixed(1);
  const avgCo = (scores.confidence/total).toFixed(1);
  const avgK = (scores.keywords/total).toFixed(1);
  const overall = ((Number(avgC)+Number(avgCo)+Number(avgK))/3).toFixed(1);

  const session = {
    id: cryptoRandomId(),
    timestamp: Date.now(),
    role: roleSelect.value,
    difficulty: difficultySelect.value,
    questions: questions,
    answers: answers,
    feedback: perQuestionFeedback,
    avgClarity: avgC, avgConfidence: avgCo, avgKeywords: avgK, overall: overall
  };
  saveSession(session);

  resultBox.innerHTML = `
    <h2 class="text-lg font-bold mb-2">Final Scorecard</h2>
    <p>Clarity: ${avgC}/5</p>
    <p>Confidence: ${avgCo}/5</p>
    <p>Keyword Coverage: ${avgK}/5</p>
    <p class="mt-2 font-semibold">Overall: ${overall}/5</p>
    <div class="mt-3 flex gap-2">
      <button id="restartBtn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Restart</button>
      <button id="downloadBtn" class="px-4 py-2 bg-gray-800 hover:bg-black text-white rounded">Download PDF</button>
    </div>
  `;
  resultBox.classList.remove("hidden");

  document.getElementById("restartBtn").onclick = () => {
    startBtn.disabled = false;
    resultBox.classList.add("hidden");
    progressWrap.classList.add("hidden");
    progressBar.style.width = "0%";
  };
  document.getElementById("downloadBtn").onclick = () => downloadPdf(session.id);
}

async function downloadPdf(id) {
  const s = getHistory().find(x => x.id === id);
  if (!s) return alert("Session not found");
  const res = await fetch(`${API_BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session: s })
  });
  if (!res.ok) return alert("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Interview_Report_${new Date(s.timestamp).toISOString().slice(0,10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Utils
function cryptoRandomId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2, 10);
}

// init
loadHistory();
