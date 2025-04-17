// index.js

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const { createCanvas, loadImage } = require("canvas");

// =================================
// Funções auxiliares de processamento
// =================================

function execPromise(cmd) {
  return new Promise((res, rej) => {
    exec(cmd, (err, stdout, stderr) =>
      err ? rej(err) : res({ stdout, stderr })
    );
  });
}

async function convertPdfPageToPng(pdfPath, pageIndex, pngPath) {
  const cmd = `magick "${pdfPath}[${pageIndex}]" "${pngPath}"`;
  await execPromise(cmd);
  console.log(`Página ${pageIndex} → ${pngPath}`);
}

async function createCompositeImage(logoPath, outPath) {
  const W = 1920,
    H = 1080;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = await loadImage(path.join(__dirname, "imagens", "background.png"));
  const logoImg = await loadImage(logoPath);
  ctx.drawImage(bg, 0, 0, W, H);

  const aspect = logoImg.width / logoImg.height;
  const defSlH = 100,
    maxSlW = 163;
  const defLbH = 60,
    maxLbW = 64;

  let slW = defSlH * aspect,
    slH = defSlH;
  if (slW > maxSlW) {
    slW = maxSlW;
    slH = maxSlW / aspect;
  }

  let lbW = defLbH * aspect,
    lbH = defLbH;
  if (lbW > maxLbW) {
    lbW = maxLbW;
    lbH = maxLbW / aspect;
  }

  const slC = [
    { x: 306, y: 330 },
    { x: 487, y: 330 },
    { x: 897, y: 330 },
    { x: 1077, y: 330 },
    { x: 1533, y: 330 },
    { x: 1716, y: 330 },
    { x: 307, y: 789 },
    { x: 487, y: 789 },
    { x: 895, y: 789 },
    { x: 1077, y: 789 },
    { x: 1533, y: 789 },
    { x: 1713, y: 789 },
  ];
  const lbC = [
    { x: 154, y: 367 },
    { x: 738, y: 367 },
    { x: 1377, y: 367 },
    { x: 154, y: 825 },
    { x: 738, y: 825 },
    { x: 1377, y: 825 },
  ];

  slC.forEach((c) => {
    ctx.drawImage(logoImg, c.x - slW / 2, c.y - slH / 2, slW, slH);
  });
  lbC.forEach((c) => {
    ctx.drawImage(logoImg, c.x - lbW / 2, c.y - lbH / 2, lbW, lbH);
  });

  await new Promise((r) => {
    const out = fs.createWriteStream(outPath);
    canvas.createPNGStream().pipe(out).on("finish", r);
  });
  console.log(`Mockup salvo: ${outPath}`);
}

async function processLogoAndCreateMockup() {
  const dir = path.join(__dirname, "imagens");
  const pdf = path.join(dir, "logo.pdf");
  const png = path.join(dir, "logo.png");
  const jpg = path.join(dir, "logo.jpg");

  let type, src;
  if (fs.existsSync(pdf)) {
    type = "pdf";
    src = pdf;
  } else if (fs.existsSync(png)) {
    type = "png";
    src = png;
  } else if (fs.existsSync(jpg)) {
    type = "jpg";
    src = jpg;
  } else throw new Error("Nenhum logo (logo.pdf/png/jpg) em imagens/.");

  if (type === "pdf") {
    let idx = 0;
    while (true) {
      const pagePng = path.join(dir, `logo_page_${idx}.png`);
      const outMock = path.join(dir, `resultado_page_${idx}.png`);
      try {
        await convertPdfPageToPng(src, idx, pagePng);
        await createCompositeImage(pagePng, outMock);
        idx++;
      } catch {
        break;
      }
    }
  } else {
    const outMock = path.join(dir, "resultado.png");
    await createCompositeImage(src, outMock);
  }
}

// ================================
// Configuração do Multer para upload
// ================================
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const imgDir = path.join(__dirname, "imagens");
    // limpa e recria imagens/ antes de todo upload
    if (fs.existsSync(imgDir))
      fs.rmSync(imgDir, { recursive: true, force: true });
    fs.mkdirSync(imgDir);
    // copia também o background para dentro de imagens/
    fs.copyFileSync(
      path.join(__dirname, "background.png"),
      path.join(imgDir, "background.png")
    );
    cb(null, imgDir);
  },
  filename(req, file, cb) {
    const name = file.originalname.toLowerCase();
    const ext = path.extname(name);
    if (name.startsWith("logo-")) {
      if (ext === ".pdf") return cb(null, "logo.pdf");
      if (ext === ".png") return cb(null, "logo.png");
      if (ext === ".jpg" || ext === ".jpeg") return cb(null, "logo.jpg");
    }
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// ================================
// Servidor Express
// ================================
const app = express();

app.get("/", (req, res) => {
  res.send(`
    <h1>Upload do Logo</h1>
    <form action="/upload" method="post" enctype="multipart/form-data">
      <input type="file" name="logo" accept=".pdf,.png,.jpg,.jpeg" required/>
      <button type="submit">Enviar</button>
    </form>
  `);
});

app.post("/upload", upload.single("logo"), async (req, res) => {
  if (!req.file) return res.status(400).send("Nenhum arquivo enviado.");

  try {
    console.log(`Arquivo recebido: ${req.file.path}`);
    await processLogoAndCreateMockup();

    // Em vez de res.send(texto), enviamos um HTML com botão de voltar
    res.send(`
      <h1>Upload e mockup gerados com sucesso!</h1>
      <p>Confira a pasta <strong>imagens/</strong> para ver o(s) arquivo(s) gerado(s).</p>
      <button onclick="window.location.href='/'">Voltar para o Início</button>
    `);
  } catch (e) {
    console.error(e);
    res.status(500).send(`
      <h1>Erro ao gerar mockup</h1>
      <button onclick="window.location.href='/'">Voltar para o Início</button>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));
