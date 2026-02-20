/**
 * layout.js
 * ------------------------------------
 * - Enforce body class
 * - Load header.html
 * - Build navigation from tools.json
 * - Auto inject data-category from tools.json
 * - Highlight nav by category
 * - Build breadcrumb
 */

/* ========= ENFORCE BODY CLASS ========= */
function enforceBodyClass() {
  document.body.classList.remove("bg-background-light", "text-slate-900");
  document.body.classList.add(
    "bg-background-dark",
    "text-slate-100",
    "min-h-screen",
    "font-display"
  );
  document.documentElement.classList.add('dark');
}

/* ========= LOAD HEADER ========= */
async function loadHeader() {
  const res = await fetch("/shared/header.html");
  const html = await res.text();

  const placeholder = document.getElementById("header-placeholder");
  if (placeholder) {
    placeholder.innerHTML = html;
  }
}

/* ========= LOAD FOOTER ========= */
async function loadFooter() {
  const res = await fetch("/shared/footer.html");
  const html = await res.text();

  const placeholder = document.getElementById("ie-footer");
  if (placeholder) {
    placeholder.innerHTML = html;
    initVisitorCounter();
  }
}

/* ========= VISITOR COUNTER ========= */
function initVisitorCounter() {
  const countSpan = document.getElementById("visit-count");
  if (!countSpan) return;

  // Using counterapi.dev for numerical counting
  const NAMESPACE = "iesupplychain.com";
  const KEY = "ietools";
  const apiUrl = `https://api.counterapi.dev/v1/${NAMESPACE}/${KEY}/up`;

  fetch(apiUrl)
    .then(res => res.json())
    .then(data => {
      if (data && data.count) {
        // Format number with commas (e.g., 1,234)
        countSpan.textContent = data.count.toLocaleString();
      } else {
        countSpan.textContent = "Live";
      }
    })
    .catch(err => {
      console.error("Counter API Error:", err);
      countSpan.textContent = "Live";
    });
}

/* ========= MAIN INIT ========= */
document.addEventListener("DOMContentLoaded", async () => {

  enforceBodyClass();
  await loadHeader();
  await loadFooter();

  const res = await fetch("/shared/tools.json");
  const data = await res.json();

  const currentPath = window.location.pathname;

  /* ========= DETECT TOOL ========= */
  const currentTool = data.tools.find(t =>
    currentPath.endsWith(t.url)
  );

  /* ========= DETECT CATEGORY ========= */
  /* ========= DETECT CATEGORY ========= */
  let currentCategory = null;

  // Case 1: tool page
  if (currentTool) {
    currentCategory = data.categories.find(
      c => c.id === currentTool.category
    );
    document.body.dataset.category = currentTool.category;
  }

  // Case 2: category page
  else if (document.body.dataset.page === "category") {
    const catId = document.body.dataset.category;
    currentCategory = data.categories.find(c => c.id === catId);
  }


  /* ========= BUILD NAV ========= */
  const nav = document.getElementById("main-nav");
  if (nav) {
    data.categories.forEach(cat => {
      const link = document.createElement("a");
      link.href = cat.url;
      link.textContent = cat.name;

      const isActive =
        document.body.dataset.category === cat.id;

      link.className = `ie-nav-link ${isActive ? "active" : ""}`;

      nav.appendChild(link);
    });
  }

  /* ========= BUILD BREADCRUMB ========= */
  const breadcrumb = document.getElementById("breadcrumb");

  if (breadcrumb && currentCategory) {
    breadcrumb.innerHTML = `
      <a href="/index.html" class="hover:text-primary">Home</a>
      <span class="mx-1">/</span>
      <a href="${currentCategory.url}" class="hover:text-primary">
        ${currentCategory.name}
      </a>
      ${currentTool ? `
        <span class="mx-1">/</span>
        <span class="text-slate-700 dark:text-slate-200 font-medium">
          ${currentTool.name}
        </span>
      ` : ""}
    `;
    breadcrumb.classList.remove("hidden");
  }

});
