/* ================================================================
   PokéBot Control Center — app.js
   All dashboard logic: tabs, API calls, rendering
   ================================================================ */

const API = "";

// â”€â”€ Utility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function api(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== null) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(API + path, opts);
    return await res.json();
  } catch (e) {
    console.error("API error:", path, e);
    return null;
  }
}

// â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("tab-active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
      btn.classList.add("tab-active");
      $("panel-" + btn.dataset.tab).classList.remove("hidden");
    });
  });
}

// â”€â”€ Status bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function refreshStatus() {
  const data = await api("/api/pok/status");
  if (!data) return;

  const badge = $("statusBadge");
  const chromeBadge = $("chromeStatus");

  if (data.bot_running) {
    badge.className = "status-badge status-running";
    badge.textContent = "▶ Running";
  } else {
    badge.className = "status-badge status-stopped";
    badge.textContent = "⏹ Stopped";
  }

  if (data.chrome_found) {
    chromeBadge.textContent = "✅ Chrome detected";
    chromeBadge.style.color = "#6ee7b7";
  } else {
    chromeBadge.textContent = "❌ Chrome not found";
    chromeBadge.style.color = "#fca5a5";
  }
}

// ————————————————————————————————————————————————————————————————
let localProfilesLoaded = false;

async function loadLocalProfiles() {
  if (localProfilesLoaded) return;
  const data = await api("/api/pok/local-profiles");
  const sel = $("profileSelect");
  if (!data || !data.local_profiles || !data.local_profiles.length) {
    sel.innerHTML = '<option value="">No profiles found</option>';
    return;
  }

  sel.innerHTML = '<option value="">— Select Chrome Profile —</option>' +
    data.local_profiles.map(p => `<option value="${esc(p.dir_name)}" data-name="${esc(p.name)}">${esc(p.name)} (${esc(p.dir_name)})</option>`).join("");

  localProfilesLoaded = true;
}

let profiles = [];

async function loadProfiles() {
  const data = await api("/api/pok/profiles");
  if (!data) return;
  profiles = data.profiles || [];
  renderProfiles();
  populateProfileDropdown();
}

function renderProfiles() {
  const list = $("profilesList");
  if (!profiles.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🖥️ </div>
        No profiles yet. Add one above.
      </div>`;
    return;
  }
  list.innerHTML = profiles.map(p => `
    <div class="item-card" data-id="${p.id}">
      <span class="item-icon">🖥️ </span>
      <div class="item-info">
        <div class="item-name">${esc(p.name)}</div>
        <div class="item-sub">Directory: ${esc(p.dir_name)}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-primary btn-sm" onclick="launchProfile('${p.id}')">🚀 Launch</button>
        <button class="btn btn-outline btn-sm" onclick="deleteProfile('${p.id}')">🗑</button>
      </div>
    </div>
  `).join("");
}

function populateProfileDropdown() {
  const sel = $("productProfile");
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Any Profile —</option>' +
    profiles.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  sel.value = cur;
}

async function launchProfile(id) {
  const assignedProducts = products.filter(p => p.profile_id === id);
  const urls = assignedProducts.map(p => p.url);

  const result = await api(`/api/profiles/${id}/launch`, "POST", { urls });
  if (result?.ok) {
    showToast("🚀 Chrome launched with assigned products!", "ok");
  } else {
    showToast("❌ " + (result?.error || "Failed"), "error");
  }
}

async function deleteProfile(id) {
  if (!confirm("Delete this profile?")) return;
  await api(`/api/profiles/${id}`, "DELETE");
  loadProfiles();
}

$("addProfileBtn").addEventListener("click", async () => {
  const sel = $("profileSelect");
  const opt = sel.options[sel.selectedIndex];
  const dirName = sel.value;

  if (!dirName || !opt) { showToast("Select a Chrome profile", "error"); return; }
  const name = opt.dataset.name || dirName;

  const result = await api("/api/pok/profiles", "POST", { name, dir_name: dirName });
  if (result?.ok) {
    $("profileSelect").value = "";
    loadProfiles();
    showToast("✅ Profile added!", "ok");
  } else {
    showToast("❌ " + (result?.error || "Failed"), "error");
  }
});

// ————————————————————————————————————————————————————————————————
let products = [];

async function loadProducts() {
  const data = await api("/api/pok/products");
  if (!data) return;
  products = data.products || [];
  renderProducts();
}

function toggleProductConfig(id) {
  const panel = $(`prod-config-${id}`);
  if (panel.classList.contains("hidden")) {
    panel.classList.remove("hidden");
  } else {
    panel.classList.add("hidden");
  }
}

async function saveProductConfig(id) {
  const payload = {
    target_qty: parseInt($(`prod-${id}-qty`).value) || null,
    max_price: parseFloat($(`prod-${id}-max_price`).value) || null,
    schedule_time: $(`prod-${id}-sched`).value || "",
    shipping: {
      first_name: $(`prod-${id}-fn`).value.trim(),
      last_name: $(`prod-${id}-ln`).value.trim(),
      address: $(`prod-${id}-addr`).value.trim(),
      apt: $(`prod-${id}-apt`).value.trim(),
      zip: $(`prod-${id}-zip`).value.trim(),
      phone: $(`prod-${id}-phone`).value.trim(),
      email: $(`prod-${id}-email`).value.trim(),
    },
    payment: {
      card_num: $(`prod-${id}-card`).value.replace(/\s+/g, ""),
      exp_month: $(`prod-${id}-exp_m`).value.trim().padStart(2, "0"),
      exp_year: $(`prod-${id}-exp_y`).value.trim(),
      cvv: $(`prod-${id}-cvv`).value.trim(),
    }
  };

  const result = await api(`/api/products/${id}`, "PUT", payload);
  if (result?.ok) {
    showToast("✅ Product config saved!", "ok");
    loadProducts(); // reload memory
    toggleProductConfig(id); // close panel
  } else {
    showToast("❌ Failed to save product config", "error");
  }
}

function renderProducts() {
  const list = $("productsList");
  if (!products.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🛒 </div>
        No products yet. Add a URL above.
      </div>`;
    return;
  }
  list.innerHTML = products.map(p => {
    const profileName = profiles.find(pr => pr.id === p.profile_id)?.name || "Any";
    const shp = p.shipping || {};
    const pay = p.payment || {};

    let storeIcon = "🛒";
    let storeBadge = "";
    if (p.url.includes("pokemoncenter.com")) { storeIcon = "⚡"; storeBadge = `<span style="font-size: 0.75rem; background: #ee1515; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle;">Pokémon Center</span>`; }
    else if (p.url.includes("target.com")) { storeIcon = "🎯"; storeBadge = `<span style="font-size: 0.75rem; background: #cc0000; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle;">Target</span>`; }
    else if (p.url.includes("walmart.com")) { storeIcon = "⭐"; storeBadge = `<span style="font-size: 0.75rem; background: #0071ce; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle;">Walmart</span>`; }

    return `
    <div style="display: flex; flex-direction: column;">
      <div class="item-card" data-id="${p.id}" style="border-radius: var(--radius) var(--radius) 0 0; border-bottom: none;">
        <span class="item-icon">${storeIcon}</span>
        <div class="item-info">
          <div class="item-name">
            <span id="status-dot-${p.id}" style="font-size:0.8em; margin-right:5px;">${p.is_open ? '🟢 Open' : '⚪ Closed'}</span>
            ${esc(p.label || p.url)} ${storeBadge}
          </div>
          <div class="item-sub">Profile: ${esc(profileName)} · <a href="${esc(p.url)}" target="_blank" style="color:var(--accent);text-decoration:none">Open Link ↗</a></div>
        </div>
        <div class="item-actions">
          <span id="status-btn-${p.id}">
            ${p.running 
              ? `<button class="btn btn-stop btn-sm" onclick="stopProduct('${p.id}')">⏹ Stop</button>`
              : `<button class="btn btn-start btn-sm" onclick="startProduct('${p.id}')">▶ Start</button>`}
          </span>
          <button class="btn btn-outline btn-sm" onclick="toggleProductConfig('${p.id}')">✎ Config</button>
          <button class="btn btn-primary btn-sm" onclick="openProductUrl('${p.id}')">🚀 Open</button>
          <button class="btn btn-outline btn-sm" onclick="deleteProduct('${p.id}')">🗑</button>
        </div>
      </div>
      
      <!-- Inline Config Panel -->
      <div id="prod-config-${p.id}" class="product-config-panel hidden">

        <div class="product-config-section">
          <h4>🎯 Bot Settings</h4>
          <div class="form-grid">
            <div class="field">
              <label>Target Qty <span style="font-size:10px;color:var(--muted);">(overrides global)</span></label>
              <input type="number" id="prod-${p.id}-qty" value="${esc(p.target_qty ?? '')}" min="1" max="99" placeholder="Global" />
            </div>
            <div class="field">
              <label>Max Price <span style="font-size:10px;color:var(--muted);">(Target/Walmart)</span></label>
              <input type="number" step="0.01" id="prod-${p.id}-max_price" value="${esc(p.max_price ?? '')}" min="0" placeholder="e.g. 59.99" />
            </div>
            <div class="field">
              <label>Schedule Start <span style="font-size:10px;color:var(--muted);">(local time)</span></label>
              <input type="datetime-local" id="prod-${p.id}-sched" value="${esc(p.schedule_time || '')}" />
            </div>
          </div>
        </div>

        <div class="product-config-section">
          <h4>📦 Shipping Profile</h4>
          <div class="form-grid">
            <div class="field"><label>First Name</label><input type="text" id="prod-${p.id}-fn" value="${esc(shp.first_name)}" /></div>
            <div class="field"><label>Last Name</label><input type="text" id="prod-${p.id}-ln" value="${esc(shp.last_name)}" /></div>
            <div class="field field-full"><label>Street Address</label><input type="text" id="prod-${p.id}-addr" value="${esc(shp.address)}" /></div>
            <div class="field"><label>Apt / Suite</label><input type="text" id="prod-${p.id}-apt" value="${esc(shp.apt)}" /></div>
            <div class="field"><label>Zip Code</label><input type="text" id="prod-${p.id}-zip" value="${esc(shp.zip)}" /></div>
            <div class="field"><label>Phone</label><input type="tel" id="prod-${p.id}-phone" value="${esc(shp.phone)}" /></div>
            <div class="field"><label>Email</label><input type="email" id="prod-${p.id}-email" value="${esc(shp.email)}" /></div>
          </div>
        </div>
        
        <div class="product-config-section">
          <h4>💳 Payment Details</h4>
          <div class="form-grid">
            <div class="field field-full"><label>Card Number</label><input type="text" id="prod-${p.id}-card" value="${esc(pay.card_num)}" maxlength="19" /></div>
            <div class="field"><label>Exp Month</label><input type="text" id="prod-${p.id}-exp_m" value="${esc(pay.exp_month || '08')}" maxlength="2" /></div>
            <div class="field"><label>Exp Year</label><input type="text" id="prod-${p.id}-exp_y" value="${esc(pay.exp_year || '2026')}" maxlength="4" /></div>
            <div class="field"><label>CVV2</label><input type="password" id="prod-${p.id}-cvv" value="${esc(pay.cvv)}" maxlength="4" /></div>
          </div>
        </div>
        
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
           <button class="btn btn-outline btn-sm" onclick="toggleProductConfig('${p.id}')">Cancel</button>
           <button class="btn btn-primary btn-sm" onclick="saveProductConfig('${p.id}')">💾 Save</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

async function openProductUrl(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  const result = await api("/api/pok/open-url", "POST", {
    url: p.url,
    profile_id: p.profile_id || null,
    product_id: p.id
  });
  if (result?.ok) {
    showToast("🚀 URL opened in Chrome!", "ok");
  } else {
    showToast("❌ " + (result?.error || "Failed to open URL"), "error");
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  await api(`/api/products/${id}`, "DELETE");
  loadProducts();
}

$("addProductBtn").addEventListener("click", async () => {
  const url = $("productUrl").value.trim();
  const label = $("productLabel").value.trim();
  const profileId = $("productProfile").value || null;

  if (!url) { showToast("Enter a product URL", "error"); return; }

  const result = await api("/api/pok/products", "POST", { url, label, profile_id: profileId });
  if (result?.ok) {
    $("productUrl").value = "";
    $("productLabel").value = "";
    loadProducts();
    showToast("✅ Product added!", "ok");
  } else {
    showToast("❌ " + (result?.error || "Failed"), "error");
  }
});

// ————————————————————————————————————————————————————————————————
async function loadConfig() {
  const data = await api("/api/pok/config");
  if (!data) return;

  $("cfgQty").value = data.target_qty ?? 1;
  $("cfgMinDelay").value = data.min_delay ?? 5;
  $("cfgMaxDelay").value = data.max_delay ?? 15;
  $("cfgSchedule").value = data.schedule_time ?? "";
}

$("saveGlobalConfigBtn").addEventListener("click", async () => {
  const payload = {
    target_qty: parseInt($("cfgQty").value) || 1,
    min_delay: parseInt($("cfgMinDelay").value) || 5,
    max_delay: parseInt($("cfgMaxDelay").value) || 15,
    schedule_time: $("cfgSchedule").value || ""
  };

  const result = await api("/api/pok/config", "POST", payload);
  const msg = $("saveGlobalMsg");
  msg.classList.remove("hidden", "ok", "error");
  if (result?.ok) {
    msg.className = "save-msg ok";
    msg.textContent = "✅ Global settings saved!";
  } else {
    msg.className = "save-msg error";
    msg.textContent = "❌ Failed to save global settings.";
  }
  msg.classList.remove("hidden");
  setTimeout(() => msg.classList.add("hidden"), 3000);
});

// ————————————————————————————————————————————————————————————————
$("startBtn").addEventListener("click", async () => {
  await api("/api/pok/commands", "POST", { cmd: "start" });
  showToast("▶ Start command sent!", "ok");
  await refreshStatus();
});

$("stopBtn").addEventListener("click", async () => {
  await api("/api/pok/commands", "POST", { cmd: "stop" });
  showToast("⏹ Stop command sent!", "ok");
  await refreshStatus();
});

// ————————————————————————————————————————————————————————————————
let lastLogCount = 0;

async function refreshLogs() {
  const data = await api("/api/pok/logs");
  if (!data) return;
  const logs = data.logs || [];
  if (logs.length === lastLogCount) return;

  lastLogCount = logs.length;
  const terminal = $("logTerminal");
  const autoScroll = $("autoScrollToggle").checked;

  terminal.innerHTML = logs.map(l => `
    <div class="log-line">
      <span class="log-ts">[${esc(l.ts)}]</span>
      <span class="log-${esc(l.level)}">${esc(l.message)}</span>
    </div>
  `).join("");

  if (autoScroll) {
    terminal.scrollTop = terminal.scrollHeight;
  }
}

$("clearLogsBtn").addEventListener("click", async () => {
  await api("/api/pok/logs/clear", "POST");
  lastLogCount = 0;
  $("logTerminal").innerHTML = "";
});

// ————————————————————————————————————————————————————————————————
let toastTimer;
function showToast(msg, type = "ok") {
  let toast = document.getElementById("_toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "_toast";
    toast.style.cssText = `
      position:fixed; bottom:28px; right:28px; z-index:9999;
      padding:12px 22px; border-radius:10px; font-size:.88rem; font-weight:600;
      backdrop-filter:blur(10px); transition:opacity .3s, transform .3s;
      pointer-events:none; font-family:inherit;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";

  if (type === "ok") {
    toast.style.background = "rgba(16,185,129,.85)";
    toast.style.color = "#fff";
    toast.style.border = "1px solid rgba(16,185,129,.5)";
  } else {
    toast.style.background = "rgba(239,68,68,.85)";
    toast.style.color = "#fff";
    toast.style.border = "1px solid rgba(239,68,68,.5)";
  }

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
  }, 3000);
}

// ————————————————————————————————————————————————————————————————
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ————————————————————————————————————————————————————————————————
async function init() {
  initTabs();
  await loadLocalProfiles();
  await loadProfiles();
  await loadProducts();
  await loadConfig();
  await refreshStatus();
  await refreshLogs();

  // Poll every 3 seconds
  setInterval(refreshStatus, 3000);
  setInterval(refreshLogs, 2000);
  setInterval(updateProductStatuses, 3000);
}

document.addEventListener("DOMContentLoaded", init);

async function startProduct(id) {
  await api(`/api/products/${id}/start`, "POST");
  updateProductStatuses();
  showToast("▶ Product start command sent!", "ok");
}

async function stopProduct(id) {
  await api(`/api/products/${id}/stop`, "POST");
  updateProductStatuses();
  showToast("⏹ Product stop command sent!", "ok");
}

async function updateProductStatuses() {
  const data = await api("/api/pok/products");
  if (!data) return;
  products = data.products || [];
  products.forEach(p => {
    const dot = $("status-dot-" + p.id);
    if (dot) {
      dot.textContent = p.is_open ? "🟢 Open" : "⚪ Closed";
    }
    const btn = $("status-btn-" + p.id);
    if (btn) {
      if (p.running) {
        btn.innerHTML = `<button class="btn btn-stop btn-sm" onclick="stopProduct('${p.id}')">⏹ Stop</button>`;
      } else {
        btn.innerHTML = `<button class="btn btn-start btn-sm" onclick="startProduct('${p.id}')">▶ Start</button>`;
      }
    }
  });
}
