// ---- Configuration ----
// RENDER_BACKEND_URL is defined inline in index.html, loaded before this file.
const API_BASE = RENDER_BACKEND_URL;

// No login/auth in this version — the backend has no user accounts,
// it's a single-user balance tracked directly in Supabase.

let cachedRate = null; // KES -> USD rate, fetched once and reused

// ---- Init ----
window.addEventListener("load", () => {
  checkConnection();
  loadBalance();
  loadRecentActivity();
});

async function checkConnection() {
  const statusEl = document.getElementById("connStatus");
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error("Backend not responding");
    statusEl.textContent = "Connected";
  } catch (err) {
    statusEl.textContent = "Connection failed";
  }
}

// ---- Navigation ----
const screens = ["balance", "deposit", "withdraw", "history"];

function showScreen(name) {
  screens.forEach((s) => {
    document.getElementById(`screen-${s}`).classList.toggle("hidden", s !== name);
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === name);
  });

  if (name === "balance") { loadBalance(); loadRecentActivity(); }
  if (name === "history") { loadHistory(currentHistoryTab); }
}

document.querySelectorAll("[data-nav]").forEach((el) => {
  el.addEventListener("click", () => showScreen(el.dataset.nav));
});

// ---- Banner ----
function showBanner(message, type) {
  const banner = document.getElementById("banner");
  banner.textContent = message;
  banner.className = `banner ${type}`;
  banner.classList.remove("hidden");
  setTimeout(() => banner.classList.add("hidden"), 5000);
}

// ---- API helper ----
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  let data;
  try { data = await res.json(); } catch (e) { data = {}; }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// ---- Balance ----
async function loadBalance() {
  try {
    const data = await apiFetch("/balance");
    document.getElementById("balance-value").textContent =
      Number(data.balance || 0).toLocaleString();
  } catch (err) {
    document.getElementById("balance-value").textContent = "0";
    showBanner(err.message, "error");
  }
}

// ---- Recent activity / history ----
async function loadRecentActivity() {
  const list = document.getElementById("recent-list");
  try {
    const txs = await apiFetch("/transactions");
    if (!txs.length) {
      list.innerHTML = `<li class="empty-row">No activity yet</li>`;
      return;
    }
    list.innerHTML = txs.slice(0, 3).map(txRow).join("");
  } catch (err) {
    list.innerHTML = `<li class="empty-row">Couldn't load activity</li>`;
  }
}

function txRow(t) {
  const date = new Date(t.created_at).toLocaleDateString();
  const label = t.type === "deposit" ? "Deposit" : "Withdrawal";
  const sign = t.type === "deposit" ? "+" : "-";
  // Withdrawal method may be stored as "mpesa:0712345678" — only show
  // the method name, not the destination, in the history list.
  const baseMethod = t.method || "";
  const methodDisplay = { mpesa: "M-Pesa", paypal: "PayPal", manual: "Manual" }[baseMethod] || baseMethod;
  return `<li>
    <div>
      <div class="row-amount">${sign}KES ${Number(t.amount).toLocaleString()}</div>
      <div class="row-meta">${label} &middot; ${methodDisplay} &middot; ${date}</div>
    </div>
    <span class="status-pill status-${t.status}">${t.status}</span>
  </li>`;
}

let currentHistoryTab = "all";

document.querySelectorAll(".history-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".history-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentHistoryTab = tab.dataset.tab;
    loadHistory(currentHistoryTab);
  });
});

async function loadHistory(filter) {
  const list = document.getElementById("history-list");
  list.innerHTML = `<li class="empty-row">Loading\u2026</li>`;
  try {
    const txs = await apiFetch("/transactions");
    const filtered = filter === "all" ? txs : txs.filter((t) => t.type === filter);
    list.innerHTML = filtered.length
      ? filtered.map(txRow).join("")
      : `<li class="empty-row">No transactions yet</li>`;
  } catch (err) {
    list.innerHTML = `<li class="empty-row">Couldn't load history</li>`;
  }
}

// ---- Currency calculator (KES -> USD) ----
async function getRate() {
  if (cachedRate) return cachedRate;
  try {
    const data = await apiFetch("/convert?amount=1&direction=kes-to-usd");
    cachedRate = data.rate;
  } catch (err) {
    cachedRate = 129; // fallback if the backend call fails
  }
  return cachedRate;
}

async function updateCalc(amountInputId, calcBoxId, verb) {
  const amountInput = document.getElementById(amountInputId);
  const calcBox = document.getElementById(calcBoxId);
  const amount = Number(amountInput.value);

  // M-Pesa and manual withdrawals stay in KES — no conversion involved.
  const withdrawMethodEl = document.getElementById("withdraw-method");
  const currentMethod = withdrawMethodEl ? withdrawMethodEl.value : null;
  const isKesOnlyWithdrawal = calcBoxId === "withdraw-calc" && (currentMethod === "mpesa" || currentMethod === "manual");

  if (!amount || amount <= 0) {
    calcBox.textContent = isKesOnlyWithdrawal
      ? "Enter an amount to withdraw."
      : `Enter an amount to see the USD equivalent${verb ? " " + verb : ""}.`;
    return;
  }

  if (isKesOnlyWithdrawal) {
    const viaText = currentMethod === "mpesa" ? "via M-Pesa" : "once the admin approves this request";
    calcBox.innerHTML = `You'll receive <b>KES ${amount.toLocaleString()}</b> ${viaText} — no conversion.`;
    return;
  }

  const rate = await getRate();
  const usd = (amount / rate).toFixed(2);
  calcBox.innerHTML = `KES ${amount.toLocaleString()} &asymp; <b>$${usd} USD</b> (rate: 1 USD = KES ${rate})`;
}

document.getElementById("deposit-amount").addEventListener("input", () => {
  updateCalc("deposit-amount", "deposit-calc", "");
});

document.getElementById("withdraw-amount").addEventListener("input", () => {
  updateCalc("withdraw-amount", "withdraw-calc", "you'll receive");
});

// ---- Deposit form ----
document.getElementById("deposit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("deposit-submit");
  const payload = Object.fromEntries(new FormData(form).entries());

  btn.disabled = true;
  btn.textContent = "Submitting\u2026";

  try {
    const data = await apiFetch("/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    showBanner(data.message || "Deposit submitted", "success");
    form.reset();
    document.getElementById("deposit-calc").textContent = "Enter an amount to see the USD equivalent.";
    showScreen("balance");
  } catch (err) {
    showBanner(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit deposit";
  }
});

// ---- Withdraw method toggle ----
document.querySelectorAll(".method-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".method-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const selectedMethod = btn.dataset.method;
    document.getElementById("withdraw-method").value = selectedMethod;

    document.getElementById("mpesa-fields").classList.toggle("hidden", selectedMethod !== "mpesa");
    document.getElementById("paypal-fields").classList.toggle("hidden", selectedMethod !== "paypal");
    document.getElementById("manual-fields").classList.toggle("hidden", selectedMethod !== "manual");

    // Only the field for the active method should be required, so the
    // browser doesn't block submission on a hidden field.
    document.querySelector('input[name="phone"]').required = selectedMethod === "mpesa";
    document.querySelector('input[name="paypalEmail"]').required = selectedMethod === "paypal";

    const calcVerb = selectedMethod === "paypal" ? "you'll receive" : "you'll receive in KES";
    updateCalc("withdraw-amount", "withdraw-calc", calcVerb);
  });
});

// ---- Withdraw form ----
document.getElementById("withdraw-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("withdraw-submit");
  const payload = Object.fromEntries(new FormData(form).entries());

  // This sends real money (or reserves a real payout for manual approval) —
  // confirm before doing anything irreversible.
  const methodLabel = { mpesa: "M-Pesa", paypal: "PayPal", manual: "manual admin approval" }[payload.method] || payload.method;
  const confirmed = confirm(`Send a withdrawal of KES ${payload.amount} via ${methodLabel}? This cannot be undone.`);
  if (!confirmed) return;

  btn.disabled = true;
  btn.textContent = "Sending\u2026";

  try {
    const data = await apiFetch("/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    showBanner(data.message || "Withdrawal sent", "success");
    form.reset();
    document.getElementById("withdraw-method").value = "manual";
    document.querySelectorAll(".method-btn").forEach((b) => b.classList.toggle("active", b.dataset.method === "manual"));
    document.getElementById("mpesa-fields").classList.add("hidden");
    document.getElementById("paypal-fields").classList.add("hidden");
    document.getElementById("manual-fields").classList.remove("hidden");
    document.getElementById("withdraw-calc").textContent = "Enter an amount to withdraw.";
    showScreen("balance");
  } catch (err) {
    showBanner(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Send withdrawal";
  }
});
