import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase JSON limit to handle audio base64 uploads
app.use(express.json({ limit: "50mb" }));

// Create necessary directories
const DATA_DIR = path.join(process.cwd(), "data");
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "audio");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Clean base64 string helper - safely strips data:...;base64, prefix for any MIME type
function extractBase64Payload(dataString: string): string {
  if (!dataString) return "";
  const commaIndex = dataString.indexOf(",");
  return commaIndex !== -1 ? dataString.slice(commaIndex + 1) : dataString;
}

// Serve uploaded audio files with full RFC 7233 HTTP 206 Partial Content (Range Request) support
// Critical for mobile iOS Safari & Android Chrome audio streaming, scrub, and playback
const handleAudioStream = (req: express.Request, res: express.Response) => {
  try {
    const rawFileName = req.params.fileName || path.basename(req.path);
    const cleanFileName = path.basename(rawFileName);
    let targetFile = path.join(UPLOAD_DIR, cleanFileName);

    if (!fs.existsSync(targetFile)) {
      if (fs.existsSync(UPLOAD_DIR)) {
        const files = fs.readdirSync(UPLOAD_DIR);
        const match = files.find((f) => f.includes(cleanFileName) || cleanFileName.includes(f));
        if (match) targetFile = path.join(UPLOAD_DIR, match);
      }
    }

    if (!fs.existsSync(targetFile)) {
      return res.status(404).json({ error: "음원 파일을 찾을 수 없습니다." });
    }

    const stat = fs.statSync(targetFile);
    const totalSize = stat.size;
    const lower = targetFile.toLowerCase();
    let mimeType = "audio/mp4";
    if (lower.endsWith(".mp3")) mimeType = "audio/mpeg";
    else if (lower.endsWith(".wav")) mimeType = "audio/wav";
    else if (lower.endsWith(".webm")) mimeType = "audio/webm";

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || (parts[1] && end >= totalSize)) {
        res.setHeader("Content-Range", `bytes */${totalSize}`);
        return res.status(416).end();
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(targetFile, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
        "Access-Control-Allow-Origin": "*",
        "Content-Disposition": "inline",
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": totalSize,
        "Accept-Ranges": "bytes",
        "Content-Type": mimeType,
        "Access-Control-Allow-Origin": "*",
        "Content-Disposition": "inline",
      });
      fs.createReadStream(targetFile).pipe(res);
    }
  } catch (err: any) {
    console.error("Audio streaming error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "음원 스트리밍 오류" });
    }
  }
};

app.get("/uploads/audio/:fileName", handleAudioStream);
app.get("/api/audio/stream/:fileName", handleAudioStream);

// General static uploads fallback
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Disposition", "inline");
    next();
  },
  express.static(path.join(process.cwd(), "uploads"))
);

// Helper to read/write JSON data
function readJsonFile<T>(fileName: string, defaultValue: T): T {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading ${fileName}:`, err);
  }
  return defaultValue;
}

function writeJsonFile<T>(fileName: string, data: T): void {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing ${fileName}:`, err);
  }
}

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", aiEnabled: Boolean(process.env.GEMINI_API_KEY) });
});

// --- COMPOSITIONS API (Tab 1) ---
app.get("/api/compositions", (_req, res) => {
  const deletedList = readJsonFile<string[]>("deleted-compositions.json", []);
  const data = readJsonFile<any[]>("compositions.json", []);
  const filtered = data.filter((c) => !deletedList.includes(c.id));
  res.json(filtered);
});

app.post("/api/compositions", (req, res) => {
  const list = readJsonFile<any[]>("compositions.json", []);
  const newItem = {
    ...req.body,
    id: req.body.id || `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: req.body.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  list.unshift(newItem);
  writeJsonFile("compositions.json", list);

  // Remove from deleted list if re-added
  let deletedList = readJsonFile<string[]>("deleted-compositions.json", []);
  if (deletedList.includes(newItem.id)) {
    deletedList = deletedList.filter((id) => id !== newItem.id);
    writeJsonFile("deleted-compositions.json", deletedList);
  }

  res.json(newItem);
});

app.put("/api/compositions/:id", (req, res) => {
  const { id } = req.params;
  const list = readJsonFile<any[]>("compositions.json", []);
  const index = list.findIndex((c) => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "문장을 찾을 수 없습니다." });
  }
  list[index] = { ...list[index], ...req.body, updatedAt: Date.now() };
  writeJsonFile("compositions.json", list);
  res.json(list[index]);
});

app.delete("/api/compositions/:id", (req, res) => {
  const { id } = req.params;
  let list = readJsonFile<any[]>("compositions.json", []);
  list = list.filter((c) => c.id !== id);
  writeJsonFile("compositions.json", list);

  // Record in persistent deleted list
  const deletedList = readJsonFile<string[]>("deleted-compositions.json", []);
  if (!deletedList.includes(id)) {
    deletedList.push(id);
    writeJsonFile("deleted-compositions.json", deletedList);
  }

  res.json({ success: true });
});

// --- AUDIO ITEMS & RECORDINGS API (Tab 2) ---
// Model: { id, title, fileName, audioUrl, myRecordingUrl, date, createdAt }
app.get("/api/audio/list", (_req, res) => {
  const list = readJsonFile<any[]>("audio-items.json", []);
  const normalized = list.map((item) => {
    if (!item.date) {
      const d = item.createdAt ? new Date(item.createdAt) : new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { ...item, date: dateStr };
    }
    return item;
  });
  res.json(normalized);
});

// Resolve audio file to Base64 (for mobile/PWA playback without range/cookie issues)
app.get("/api/audio/resolve-base64", (req, res) => {
  try {
    const rawPath = (req.query.path as string) || "";
    const id = (req.query.id as string) || "";

    const baseName = path.basename(rawPath);
    let targetFile = path.join(UPLOAD_DIR, baseName);

    // Fallback: match by ID in filename
    if (!fs.existsSync(targetFile) && id) {
      if (fs.existsSync(UPLOAD_DIR)) {
        const files = fs.readdirSync(UPLOAD_DIR);
        const match = files.find((f) => f.includes(id));
        if (match) {
          targetFile = path.join(UPLOAD_DIR, match);
        }
      }
    }

    // Fallback: if only one audio file exists and requested file is missing, use it
    if (!fs.existsSync(targetFile) && fs.existsSync(UPLOAD_DIR)) {
      const files = fs.readdirSync(UPLOAD_DIR).filter((f) => !f.startsWith("."));
      if (files.length === 1) {
        targetFile = path.join(UPLOAD_DIR, files[0]);
      }
    }

    if (fs.existsSync(targetFile)) {
      const buffer = fs.readFileSync(targetFile);
      const lower = targetFile.toLowerCase();
      let mimeType = "audio/mp4";
      if (lower.endsWith(".mp3")) mimeType = "audio/mpeg";
      else if (lower.endsWith(".wav")) mimeType = "audio/wav";
      else if (lower.endsWith(".webm")) mimeType = "audio/webm";

      const base64 = `data:${mimeType};base64,${buffer.toString("base64")}`;
      return res.json({ base64, mimeType, size: buffer.length });
    }

    return res.status(404).json({ error: "음원 파일을 찾을 수 없습니다." });
  } catch (err: any) {
    console.error("resolve-base64 error:", err);
    res.status(500).json({ error: "음원 변환 실패" });
  }
});

// Upload target audio file (MP3/M4A/WAV)
app.post("/api/audio/upload", (req, res) => {
  try {
    const { title, fileName, fileBase64, date, transcript } = req.body;
    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: "파일 데이터가 올바르지 않습니다." });
    }

    const id = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ext = path.extname(fileName) || ".mp3";
    const diskFileName = `${id}${ext}`;
    const filePath = path.join(UPLOAD_DIR, diskFileName);

    // Safely extract pure base64 payload
    const base64Data = extractBase64Payload(fileBase64);
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, buffer);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const audioUrl = `/uploads/audio/${diskFileName}`;
    const newItem = {
      id,
      title: title?.trim() || fileName.replace(/\.[^/.]+$/, ""),
      fileName,
      audioUrl,
      audioBase64: fileBase64, // Keep base64 for instant mobile & PWA playback
      myRecordingUrl: null,
      myRecordingBase64: null,
      date: date || todayStr,
      transcript: transcript?.trim() || "",
      createdAt: Date.now(),
    };

    const list = readJsonFile<any[]>("audio-items.json", []);
    list.unshift(newItem);
    writeJsonFile("audio-items.json", list);

    res.json(newItem);
  } catch (err: any) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "음성 파일 업로드에 실패했습니다." });
  }
});

// Update audio item details (e.g. title, date, or transcript)
app.put("/api/audio/:id", (req, res) => {
  const { id } = req.params;
  const list = readJsonFile<any[]>("audio-items.json", []);
  const index = list.findIndex((a) => a.id === id);
  if (index !== -1) {
    list[index] = { ...list[index], ...req.body, updatedAt: Date.now() };
    writeJsonFile("audio-items.json", list);
    return res.json(list[index]);
  }
  res.status(404).json({ error: "음성 항목을 찾을 수 없습니다." });
});

app.patch("/api/audio/:id", (req, res) => {
  const { id } = req.params;
  const list = readJsonFile<any[]>("audio-items.json", []);
  const index = list.findIndex((a) => a.id === id);
  if (index !== -1) {
    list[index] = { ...list[index], ...req.body, updatedAt: Date.now() };
    writeJsonFile("audio-items.json", list);
    return res.json(list[index]);
  }
  res.status(404).json({ error: "음성 항목을 찾을 수 없습니다." });
});

// Save user's voice recording for an audio item
app.post("/api/audio/:id/recording", (req, res) => {
  try {
    const { id } = req.params;
    const { recordingBase64, mimeType, duration, title, fileName, date, audioUrl } = req.body;

    if (!recordingBase64) {
      return res.status(400).json({ error: "녹음 데이터가 없습니다." });
    }

    const list = readJsonFile<any[]>("audio-items.json", []);
    let item = list.find((a) => a.id === id);

    // Determine extension
    let ext = ".m4a";
    const lowerMime = (mimeType || "").toLowerCase();
    if (lowerMime.includes("webm")) ext = ".webm";
    else if (lowerMime.includes("wav")) ext = ".wav";
    else if (lowerMime.includes("mp4") || lowerMime.includes("m4a")) ext = ".m4a";

    const diskFileName = `my-rec-${id}-${Date.now()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, diskFileName);

    const base64Data = extractBase64Payload(recordingBase64);
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, buffer);

    const recordingUrl = `/uploads/audio/${diskFileName}`;

    if (item) {
      item.myRecordingUrl = recordingUrl;
      item.myRecordingBase64 = recordingBase64;
      if (typeof duration === "number") item.myRecordingDuration = duration;
      item.updatedAt = Date.now();
    } else {
      // Create new record for items synced via Firestore
      item = {
        id,
        title: title || `음성 ${id}`,
        fileName: fileName || `${id}${ext}`,
        audioUrl: audioUrl || '',
        audioBase64: '',
        myRecordingUrl: recordingUrl,
        myRecordingBase64: recordingBase64,
        myRecordingDuration: typeof duration === "number" ? duration : null,
        date: date || new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      list.push(item);
    }

    writeJsonFile("audio-items.json", list);
    res.json(item);
  } catch (err: any) {
    console.error("Recording save error:", err);
    res.status(500).json({ error: "녹음 저장에 실패했습니다." });
  }
});

// Delete user's recording for an audio item
app.delete("/api/audio/:id/recording", (req, res) => {
  const { id } = req.params;
  const list = readJsonFile<any[]>("audio-items.json", []);
  const item = list.find((a) => a.id === id);
  if (item) {
    item.myRecordingUrl = null;
    item.myRecordingBase64 = null;
    item.myRecordingDuration = null;
    writeJsonFile("audio-items.json", list);
  }
  res.json({ success: true });
});

// Delete entire audio item
app.delete("/api/audio/:id", (req, res) => {
  const { id } = req.params;
  let list = readJsonFile<any[]>("audio-items.json", []);
  list = list.filter((a) => a.id !== id);
  writeJsonFile("audio-items.json", list);

  const deletedList = readJsonFile<string[]>("deleted-audio.json", []);
  if (!deletedList.includes(id)) {
    deletedList.push(id);
    writeJsonFile("deleted-audio.json", deletedList);
  }

  res.json({ success: true });
});

// --- KEY EXPRESSIONS API (Tab 3) ---
app.get("/api/expressions", (_req, res) => {
  const deletedList = readJsonFile<string[]>("deleted-expressions.json", []);
  const list = readJsonFile<any[]>("expressions.json", []);
  const filtered = list.filter((item) => !deletedList.includes(item.id));
  const normalized = filtered.map((item) => {
    if (!item.date) {
      const d = item.createdAt ? new Date(item.createdAt) : new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { ...item, date: dateStr };
    }
    return item;
  });
  res.json(normalized);
});

app.post("/api/expressions", (req, res) => {
  const list = readJsonFile<any[]>("expressions.json", []);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const newItem = {
    ...req.body,
    id: req.body.id || `expr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: req.body.date || todayStr,
    createdAt: req.body.createdAt || Date.now(),
  };

  const existingIdx = list.findIndex((e) => e.id === newItem.id);
  if (existingIdx !== -1) {
    list[existingIdx] = { ...list[existingIdx], ...newItem };
  } else {
    list.unshift(newItem);
  }
  writeJsonFile("expressions.json", list);

  // If was previously deleted, remove from deleted list
  let deletedList = readJsonFile<string[]>("deleted-expressions.json", []);
  if (deletedList.includes(newItem.id)) {
    deletedList = deletedList.filter((id) => id !== newItem.id);
    writeJsonFile("deleted-expressions.json", deletedList);
  }

  res.json(newItem);
});

app.put("/api/expressions/:id", (req, res) => {
  const { id } = req.params;
  const list = readJsonFile<any[]>("expressions.json", []);
  const index = list.findIndex((e) => e.id === id);
  if (index !== -1) {
    list[index] = { ...list[index], ...req.body };
    writeJsonFile("expressions.json", list);
    return res.json(list[index]);
  }
  // Upsert if not found
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const newItem = {
    ...req.body,
    id,
    date: req.body.date || todayStr,
    createdAt: req.body.createdAt || Date.now(),
  };
  list.unshift(newItem);
  writeJsonFile("expressions.json", list);
  res.json(newItem);
});

app.delete("/api/expressions/:id", (req, res) => {
  const { id } = req.params;
  let list = readJsonFile<any[]>("expressions.json", []);
  list = list.filter((e) => e.id !== id);
  writeJsonFile("expressions.json", list);

  // Record in persistent deleted list
  const deletedList = readJsonFile<string[]>("deleted-expressions.json", []);
  if (!deletedList.includes(id)) {
    deletedList.push(id);
    writeJsonFile("deleted-expressions.json", deletedList);
  }

  res.json({ success: true });
});

// AI English Composition Feedback & Polish Suggestion
app.post("/api/ai/review", async (req, res) => {
  try {
    const { korean, english } = req.body;

    if (!korean || !english) {
      return res.status(400).json({ error: "한글 문장과 영작 문장을 모두 입력해주세요." });
    }

    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        polishedSentence: english.trim(),
        tip: "원어민 뉘앙스 검토가 준비되었습니다.",
      });
    }

    const prompt = `한글 문장: "${korean}"
사용자 영작문: "${english}"

이 문장을 원어민이 일상이나 업무에서 실제로 사용하는 가장 자연스럽고 세련된 영어 표현(다듬은 표현)으로 개선해주세요.
JSON 형식으로만 응답:
{
  "polishedSentence": "가장 자연스럽게 다듬은 완성된 영어 문장 1개",
  "tip": "어떤 점을 다듬었는지 1문장 한글 설명"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    try {
      const parsed = JSON.parse(responseText);
      return res.json(parsed);
    } catch {
      return res.json({
        polishedSentence: english.trim(),
        tip: "자연스러운 문장입니다.",
      });
    }
  } catch (error: any) {
    console.error("AI Review error:", error);
    res.status(500).json({
      error: "AI 추천 생성 실패",
      details: error?.message || String(error),
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Daily English Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

