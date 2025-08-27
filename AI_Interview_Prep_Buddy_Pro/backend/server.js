import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

const PORT = process.env.PORT || 3000;

// --- Question bank (per role, variety) ---
const bank = {
  software: [
    "Explain the concept of polymorphism in OOP.",
    "What is the difference between processes and threads?",
    "How would you detect and optimize performance bottlenecks in an application?",
    "Explain Big-O notation with examples.",
    "What are REST APIs and how do they work?",
    "Describe a time you debugged a hard issue. What steps did you take?",
    "How do you design a scalable URL shortener?"
  ],
  cybersecurity: [
    "What is the difference between symmetric and asymmetric encryption?",
    "Explain the CIA triad in cybersecurity.",
    "How do firewalls protect networks?",
    "What is SQL injection and how can it be prevented?",
    "Explain zero-day vulnerability.",
    "How would you respond to a ransomware incident?",
    "What steps are in a typical vulnerability assessment?"
  ],
  frontend: [
    "What is the difference between React and plain JavaScript?",
    "Explain the CSS box model.",
    "What are the advantages of using Tailwind CSS?",
    "How does the virtual DOM improve performance?",
    "What is responsive design and how do you achieve it?",
    "How would you improve web performance for a heavy page?",
    "Explain accessibility (a11y) best practices you use."
  ]
};

// --- Keywords per role for simple scoring ---
const roleKeywords = {
  software: ["time complexity","space complexity","polymorphism","inheritance","api","thread","process","scalable","big-o","rest","http","cache"],
  cybersecurity: ["cia","confidentiality","integrity","availability","firewall","encryption","symmetric","asymmetric","sql injection","xss","vulnerability","mitigation","incident","ransomware","zero-day"],
  frontend: ["react","virtual dom","css","box model","responsive","tailwind","bundle","lazy load","accessibility","a11y","aria","performance","lighthouse"]
};

// --- Difficulty weights ---
const diffWeights = { easy: 0.9, medium: 1.0, hard: 1.1 };

// Utility: pick N random questions
function pickRandom(arr, n=5) {
  const copy = [...arr];
  for (let i=copy.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// Simple heuristic scoring if no OpenAI key
function heuristicScore({answer, role, difficulty}) {
  const text = (answer || "").toLowerCase();
  const kws = roleKeywords[role] || [];
  const matches = kws.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
  // basic metrics
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentences = (text.match(/[.!?]/g) || []).length;

  // clarity: based on sentences and punctuation
  let clarity = Math.min(5, Math.max(1, Math.round((sentences + (text.includes(":")||text.includes("-")?1:0)) * 1.2)));
  // confidence: decisive words and length
  const decisive = /(i implemented|i would|we did|we used|therefore|so|thus|confident|clearly|best)/i.test(answer||"");
  let confidence = Math.min(5, Math.max(1, Math.round((decisive?3:2) + (words>60?1:0))));
  // keywords
  let keywords = Math.min(5, Math.max(1, Math.round((matches / Math.max(3, kws.length/4)) * 5)));

  const w = diffWeights[difficulty] || 1.0;
  clarity = Math.min(5, Math.max(1, Math.round(clarity * w)));
  confidence = Math.min(5, Math.max(1, Math.round(confidence * w)));
  keywords = Math.min(5, Math.max(1, Math.round(keywords * w)));

  let tip = "";
  if (keywords < 3) tip += "Add more technical keywords related to the topic. ";
  if (clarity < 3) tip += "Structure your answer into clear steps or bullets. ";
  if (confidence < 3) tip += "State decisions and justify trade-offs. ";
  tip = tip || "Good structure. Add example + metric to strengthen it.";

  return { clarity, confidence, keywords, tip };
}

// Optional: OpenAI for richer feedback
async function aiScore({question, answer}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  const prompt = `You are an interview coach. Score the following answer from 1-5 for clarity, confidence, and keyword coverage. Then give one concise improvement tip.
Question: ${question}
Answer: ${answer}
Respond as JSON: {"clarity":<1-5>,"confidence":<1-5>,"keywords":<1-5>,"tip":"..."}`;

  try {
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    });
    const text = resp.choices?.[0]?.message?.content?.trim();
    const parsed = JSON.parse(text);
    ["clarity","confidence","keywords"].forEach(k => {
      parsed[k] = Math.max(1, Math.min(5, Math.round(parsed[k])));
    });
    return parsed;
  } catch (e) {
    return null;
  }
}

// --- Routes ---
app.get("/api/health", (req,res)=> res.json({ ok:true }));

app.get("/api/questions", (req, res) => {
  const { role="software", difficulty="medium" } = req.query;
  const pool = bank[role] || bank.software;
  const qs = pickRandom(pool, 5);
  const finalQs = qs.map(q => difficulty==="hard" ? q + " (Discuss trade-offs, edge cases, metrics.)" : q);
  res.json(finalQs);
});

app.post("/api/feedback", async (req, res) => {
  const { role="software", difficulty="medium", question="", answer="" } = req.body || {};
  let result = await aiScore({question, answer});
  if (!result) result = heuristicScore({answer, role, difficulty});
  res.json(result);
});

app.post("/api/export", async (req, res) => {
  const { session } = req.body || {};
  if (!session) return res.status(400).json({ error: "Missing session" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=Interview_Report.pdf");

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  doc.fontSize(20).text("AI Interview Prep Buddy — Report", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#666").text(new Date(session.timestamp).toString(), { align: "center" });
  doc.moveDown(1);
  doc.fillColor("#000").fontSize(12).text(`Role: ${session.role}`);
  doc.text(`Difficulty: ${session.difficulty}`);
  doc.text(`Overall: ${session.overall}/5 (Clarity ${session.avgClarity}/5, Confidence ${session.avgConfidence}/5, Keywords ${session.avgKeywords}/5)`);

  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

  doc.moveDown(0.5);
  session.questions.forEach((q, i) => {
    doc.fontSize(11).fillColor("#111").text(`${i+1}. ${q}`, { continued: false });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#333").text(`Your Answer: ${session.answers?.[i] || "(empty)"}`);
    const fb = session.feedback?.[i] || {};
    doc.fontSize(10).fillColor("#000").text(`Feedback — C:${fb.clarity || "-"} Co:${fb.confidence || "-"} K:${fb.keywords || "-"}`);
    if (fb.tip) doc.fillColor("#555").text(`Tip: ${fb.tip}`);
    doc.moveDown(0.6);
  });

  doc.end();
});
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend build on Render
app.use(express.static(path.join(__dirname, "../frontend/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
