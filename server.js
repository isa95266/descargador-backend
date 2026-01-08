const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
// Puerto dinámico para la nube (Render) o 3000 para local
const PORT = process.env.PORT || 3000;

app.use(cors());

const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

// ================= PROGRESO (SSE) =================
let clients = [];

app.get("/progress-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  clients.push(res);

  req.on("close", () => {
    clients = clients.filter(c => c !== res);
  });
});

function sendProgress(value) {
  clients.forEach(c => c.write(`data: ${value}\n\n`));
}

// ================= DESCARGA =================
app.get("/download/:format", (req, res) => {
  const { format } = req.params;
  const { url, quality } = req.query;

  if (!url) return res.status(400).json({ error: "URL requerida" });

  const fileName = `media_${Date.now()}.${format}`;
  const outputPath = path.join(DOWNLOADS_DIR, fileName);

  // ARGUMENTOS: Usamos 'yt-dlp' directamente (el sistema debe tenerlo en el PATH)
  let args = [];
  if (format === "mp3") {
    // --force-overwrites evita errores si el archivo ya existe
    args = ["-x", "--audio-format", "mp3", "--force-overwrites", "-o", outputPath, url];
  } else {
    // Selección de calidad simplificada para evitar errores de merging
    args = ["-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b", "-o", outputPath, url];
  }

  // IMPORTANTE: 'yt-dlp' debe estar instalado en el entorno (Docker)
  const ytdlp = spawn("yt-dlp", args);

  ytdlp.stdout.on("data", data => {
    const match = data.toString().match(/(\d+(?:\.\d+)?)%/);
    if (match) sendProgress(match[1]);
  });

  ytdlp.stderr.on("data", (data) => {
    console.error(`stderr: ${data}`); // Útil para ver errores en los logs de Render
  });

  ytdlp.on("close", code => {
    sendProgress(100);
    if (code === 0 && fs.existsSync(outputPath)) {
      res.json({ file: fileName });
    } else {
      res.status(500).json({ error: "Falló la descarga o conversión" });
    }
  });
});

// ================= SERVIR ARCHIVO =================
app.get("/file/:name", (req, res) => {
  const filePath = path.join(DOWNLOADS_DIR, req.params.name);
  if (!fs.existsSync(filePath)) return res.sendStatus(404);
  
  // Forzar descarga con el nombre correcto
  res.download(filePath, (err) => {
      if (!err) {
          // Opcional: Borrar archivo después de descargar para ahorrar espacio en servidor
          // fs.unlinkSync(filePath); 
      }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Backend activo en puerto ${PORT}`);
});