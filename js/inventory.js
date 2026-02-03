/**
 * Load danh sách TOOLS cho page INVENTORY
 * ------------------------------------------------
 * Khi đổi sang Lean / Inventory:
 * 👉 CHỈ CẦN ĐỔI GIÁ TRỊ category ở chỗ filter
 * 👉 Không cần sửa logic còn lại
 */

async function loadInventoryTools() {

  // 1️⃣ Load file config trung tâm (chứa categories + tools)
  const res = await fetch("../shared/tools.json");
  const data = await res.json();

  // 2️⃣ Lấy container nơi sẽ render danh sách tool
  // (phải trùng id với HTML: <div id="tool-list"></div>)
  const container = document.getElementById("tool-list");
  if (!container) return;

  // 3️⃣ FILTER TOOLS THEO CATEGORY
  // 🔴 ĐÂY LÀ CHỖ DUY NHẤT CẦN ĐỔI KHI SANG PAGE KHÁC
  const tools = data.tools.filter(
    t => t.category === "inventory" 
    // 👉 đổi thành:
    // "lean"        → cho Lean Tools page
    // "inventory"   → cho Inventory Tools page
  );

  // 4️⃣ Render từng tool thành card
  tools.forEach(tool => {

    // Mỗi tool là 1 card link tới tool detail page
    const card = document.createElement("a");
    card.href = tool.url;
    card.className = "ie-card hover:shadow-lg transition";

    // Nội dung card lấy hoàn toàn từ tools.json
    card.innerHTML = `
      <h3 class="ie-card-title">${tool.name}</h3>
      <p class="text-sm text-slate-500 mt-2">
        ${tool.description}
      </p>
    `;

    container.appendChild(card);
  });
}

// 5️⃣ Khi page load xong thì render tool list
document.addEventListener("DOMContentLoaded", loadInventoryTools);
