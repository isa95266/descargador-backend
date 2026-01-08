const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
// Render asigna un puerto automáticamente en process.env.PORT
const PORT = process.env.PORT || 3000;

app.use(cors());

// Configurar carpeta de descargas temporales
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
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL requerida" });
  }

  const fileName = `media_${Date.now()}.${format}`;
  const outputPath = path.join(DOWNLOADS_DIR, fileName);

  // Argumentos optimizados para evitar bloqueos y mejorar compatibilidad
  let args = [
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "--no-check-certificates",
    "--no-warnings",
    "--newline" // Importante para que el progreso se lea línea a línea
  ];

  if (format === "mp3") {
    args.push("-x", "--audio-format", "mp3", "-o", outputPath, url);
  } else {
    // Busca la mejor calidad de video mp4 y audio m4a y los une
    args.push("-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]", "-o", outputPath, url);
  }

  // Ejecutamos yt-dlp (en Docker/Linux no lleva .exe)
  const ytdlp = spawn("yt-dlp", args);

  ytdlp.stdout.on("data", data => {
    const output = data.toString();
    // Buscamos el porcentaje en el texto de salida
    const match = output.match(/(\d+(?:\.\d+)?)%/);
    if (match) {
      sendProgress(match[1]);
    }
  });

  ytdlp.stderr.on("data", data => {
    console.error(`Dato de error o aviso: ${data}`);
  });

  ytdlp.on("close", code => {
    if (code === 0 && fs.existsSync(outputPath)) {
      sendProgress(100);
      res.json({ file: fileName });
    } else {
      res.status(500).json({ error: "Error en el proceso de yt-dlp" });
    }
  });
});

// ================= SERVIR EL ARCHIVO PARA DESCARGA =================
app.get("/file/:name", (req, res) => {
  const filePath = path.join(DOWNLOADS_DIR, req.params.name);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (!err) {
        // Borrar el archivo del servidor después de enviarlo para no llenar el disco
        setTimeout(() => {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }, 10000); 
      }
    });
  } else {
    res.status(404).send("Archivo no encontrado");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});
