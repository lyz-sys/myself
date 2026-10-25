const nav = document.querySelector(".nav");
const pdfBtn = document.querySelector(".pdf-btn");
let pack = null;
let currentLang = document.documentElement.lang === "en" ? "en" : "zh";
let pdfBusy = false;

const syncNavHeight = () => {
  document.documentElement.style.setProperty("--nav-h", `${nav.offsetHeight}px`);
};

function getByPath(obj, keyPath) {
  return keyPath.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function applyLanguage(lang) {
  const dict = pack[lang];
  if (!dict) return;
  currentLang = lang;
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  document.title = dict.metaTitle;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", dict.metaDescription);
  const author = document.querySelector('meta[name="author"]');
  if (author) author.setAttribute("content", dict.name);

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    if (pdfBusy && el === pdfBtn) return;
    const value = getByPath(dict, el.getAttribute("data-i18n"));
    if (typeof value === "string") el.textContent = value;
  });

  document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    const value = getByPath(dict, el.getAttribute("data-i18n-alt"));
    if (typeof value === "string") el.alt = value;
  });

  document.querySelectorAll("[data-i18n-href]").forEach((el) => {
    const value = getByPath(dict, el.getAttribute("data-i18n-href"));
    if (typeof value === "string") el.href = value;
  });

  document.querySelectorAll("[data-lang]").forEach((button) => {
    const active = button.getAttribute("data-lang") === lang;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  try {
    localStorage.setItem("site-lang", lang);
  } catch (e) {}

  document.documentElement.classList.add("ready");
  syncNavHeight();
}

async function downloadResume() {
  if (pdfBusy) return;
  pdfBusy = true;
  pdfBtn.disabled = true;
  pdfBtn.textContent = pack[currentLang].pdfBusy;
  try {
    const response = await fetch(`/api/resume.pdf?lang=${currentLang}`);
    if (!response.ok) throw new Error(await response.text());
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const who = pack[currentLang].name;
    link.download = currentLang === "en" ? `${who}-Resume.pdf` : `${who}-简历.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    pdfBtn.textContent = pack[currentLang].pdfFail;
    await new Promise((resolve) => setTimeout(resolve, 1600));
  } finally {
    pdfBusy = false;
    pdfBtn.disabled = false;
    pdfBtn.textContent = pack[currentLang].pdf;
  }
}

const links = [...document.querySelectorAll(".nav-links a")];
const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);

const markActive = () => {
  nav.classList.toggle("is-scrolled", window.scrollY > 8);
  const marker = window.scrollY + nav.offsetHeight + 24;
  let current = null;
  for (const section of sections) {
    if (section.offsetTop <= marker) current = section;
  }
  for (const link of links) {
    const active = current && link.getAttribute("href") === `#${current.id}`;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }
};

document.addEventListener("scroll", markActive, { passive: true });
window.addEventListener("resize", syncNavHeight);
document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.getAttribute("data-lang")));
});
pdfBtn.addEventListener("click", downloadResume);

const year = document.querySelector("[data-year]");
if (year) year.textContent = String(new Date().getFullYear());

fetch("/content/copy.json")
  .then((response) => response.json())
  .then((data) => {
    pack = data;
    applyLanguage(currentLang);
    markActive();
  })
  .catch(() => {
    document.documentElement.classList.add("ready");
  });

syncNavHeight();
markActive();
