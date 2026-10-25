const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const root = __dirname;
const port = Number(process.env.PORT) || 8090;
const host = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function readCopy() {
  return JSON.parse(fs.readFileSync(path.join(root, "content", "copy.json"), "utf8"));
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

function renderResume(pack, lang) {
  const list = (items) => items.map((item) => `<li>${esc(item)}</li>`).join("");
  const jobs = pack.experience.map((job) => `
    <article class="job">
      <div class="job-head">
        <p class="role">${esc(job.role)}</p>
        <p class="meta">${esc(job.when)} · ${esc(job.where)}</p>
      </div>
      <p class="org">${esc(job.org)}</p>
      <ul>${list(job.bullets)}</ul>
    </article>`).join("");

  const schools = pack.education.map((school) => `
    <div class="school">
      <p class="role">${esc(school.degree)} · ${esc(school.school)}</p>
      <p class="meta">${esc(school.when)}</p>
    </div>`).join("");

  const skills = pack.skills.map((skill) => `
    <div><dt>${esc(skill.label)}</dt><dd>${esc(skill.value)}</dd></div>`).join("");

  const principles = pack.principles.map((item) => `
    <p class="para"><strong>${esc(item.title)}</strong> ${esc(item.body)}</p>`).join("");

  const about = pack.about.map((paragraph) => `<p class="para">${esc(paragraph)}</p>`).join("");
  const project = pack.project;
  const facts = project.facts.map((fact) => `${esc(fact.label)}：${esc(fact.value)}`).join(" · ");
  const interests = pack.interests.map((item) => `
    <p class="para"><strong>${esc(item.title)}</strong>${item.body ? ` ${esc(item.body)}` : ""}</p>`).join("");
  const repos = pack.repos.map((repo) => `
    <li><a href="${esc(repo.url)}">${esc(repo.name)}</a> — ${esc(repo.body)}</li>`).join("");
  const channels = pack.channels;

  return `<!DOCTYPE html>
<html lang="${lang === "en" ? "en" : "zh-CN"}">
<head>
  <meta charset="UTF-8" />
  <title>${esc(pack.name)}</title>
  <link rel="stylesheet" href="/css/resume.css" />
</head>
<body>
  <header class="top">
    <div>
      <h1>${esc(pack.name)}</h1>
      <p class="headline">${esc(pack.facts[0].value)}</p>
    </div>
    <p class="contact">
      ${esc(channels.email)}<br />
      ${esc(channels.phone)}<br />
      ${esc(pack.wechatLabel)} ${esc(channels.wechat)}
    </p>
  </header>
  <h2>${esc(pack.aboutTitle)}</h2>
  <p class="para">${esc(pack.lede)}</p>
  ${about}
  <p class="kicker">${esc(pack.principlesLabel)}</p>
  ${principles}
  <h2>${esc(pack.experienceTitle)}</h2>
  ${jobs}
  <h2>${esc(pack.educationTitle)}</h2>
  <div class="block">${schools}</div>
  <h2>${esc(pack.skillsTitle)}</h2>
  <dl class="skills">${skills}</dl>
  <h2>${esc(pack.otherTitle)}</h2>
  <p class="para"><a href="${esc(pack.github.href)}">${esc(pack.github.label)}</a>${esc(pack.githubLead)}</p>
  <article class="block">
    <div class="job-head">
      <p class="role">${esc(project.title)}</p>
      <p class="meta">${esc(project.when)}</p>
    </div>
    <p class="para">${esc(project.summary)}</p>
    <ul>${list(project.bullets)}</ul>
    <p class="para">${facts}</p>
    <p class="para"><a href="${esc(project.url)}">${esc(project.urlLabel)}</a></p>
  </article>
  ${interests}
  <p class="para"><strong>${esc(pack.game.title)}</strong> ${esc(pack.game.tagline)} <a href="${esc(pack.game.url)}">${esc(pack.game.host)}</a></p>
  <ul>${repos}</ul>
</body>
</html>`;
}

function edgeExecutable() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return candidates.find((item) => fs.existsSync(item)) || null;
}

function printPdf(url, outFile) {
  const edge = edgeExecutable();
  if (!edge) return Promise.reject(new Error("Microsoft Edge was not found"));

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "myself-edge-"));
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-pdf-header-footer",
    "--virtual-time-budget=8000",
    `--user-data-dir=${profile}`,
    `--print-to-pdf=${outFile}`,
    url,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(edge, args, { stdio: "ignore" });
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("PDF generation timed out"));
    }, 25000);
    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      fs.rm(profile, { recursive: true, force: true }, () => {});
      if (code === 0 && fs.existsSync(outFile) && fs.statSync(outFile).size > 1000) resolve();
      else reject(new Error(`PDF generation failed (${code})`));
    });
  });
}

function resolveStatic(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded === "/" ? "/index.html" : decoded;
  const full = path.resolve(root, `.${rel}`);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  if (full.includes(`${path.sep}scripts${path.sep}`) || full.includes(`${path.sep}logs${path.sep}`)) return null;
  return full;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${host}:${port}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, port }));
    return;
  }

  if (url.pathname === "/resume") {
    const lang = url.searchParams.get("lang") === "en" ? "en" : "zh";
    const pack = readCopy()[lang];
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderResume(pack, lang));
    return;
  }

  if (url.pathname === "/api/resume.pdf") {
    const lang = url.searchParams.get("lang") === "en" ? "en" : "zh";
    const pack = readCopy()[lang];
    const file = path.join(os.tmpdir(), `myself-resume-${lang}-${Date.now()}.pdf`);
    const filename = lang === "en" ? `${pack.name}-Resume.pdf` : `${pack.name}-简历.pdf`;
    try {
      await printPdf(`http://${host}:${port}/resume?lang=${lang}`, file);
      const pdf = fs.readFileSync(file);
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${lang === "en" ? filename : "resume.pdf"}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": pdf.length,
        "Cache-Control": "no-store",
      });
      res.end(pdf);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.message || "PDF generation failed");
    } finally {
      fs.rm(file, { force: true }, () => {});
    }
    return;
  }

  const file = resolveStatic(url.pathname);
  if (!file) {
    res.writeHead(400);
    res.end("Bad path");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Personal site running at http://${host}:${port}`);
});
