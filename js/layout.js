/**
 * layout.js
 * ------------------------------------
 * - Load header.html
 * - Sinh navigation từ tools.json
 * - Tự active menu theo URL
 */

/* ========= LOAD HEADER ========= */
async function loadHeader() {
  const res = await fetch("/shared/header.html");
  const html = await res.text();

  const placeholder = document.getElementById("header-placeholder");
  if (placeholder) {
    placeholder.innerHTML = html;
  }
}

/* ========= BUILD NAV ========= */
async function buildNavigation() {
  const res = await fetch("/shared/tools.json");
  const data = await res.json();

  const nav = document.getElementById("main-nav");
  if (!nav) return;

  const currentPath = window.location.pathname;

  data.categories.forEach(cat => {
    const link = document.createElement("a");
    link.href = cat.url;
    link.textContent = cat.name;

    const isActive = currentPath.startsWith(cat.url);

    link.className = `
      text-sm font-medium h-full flex items-center
      transition-colors
      ${isActive
        ? "text-primary border-b-2 border-primary"
        : "text-slate-600 dark:text-slate-400 hover:text-primary"}
    `;

    nav.appendChild(link);
  });
}

/* ========= INIT ========= */
document.addEventListener("DOMContentLoaded", async () => {
  await loadHeader();
  await buildNavigation();
});
