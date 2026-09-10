// ---- Configuration ----
// SUPABASE_URL, SUPABASE_ANON_KEY, RENDER_BACKEND_URL and `sb` are
// defined in the inline config block in index.html, loaded before this file.
const API_BASE = RENDER_BACKEND_URL;

// ---- Auth ----
let authMode = "login"; // "login" | "signup"

function showApp() {
  document.getElementById("auth-overlay").classList.add("hidden");
  document.getElementById("main-area").classList.remove("hidden");
  document.getElementById("logout-btn").classList.remove("hidden");
}

function showAuth() {
  document.getElementById("auth-overlay").classList.remove("hidden");
  document.getElementById("main-area").classList.add("hidden");
  document.getElementById("logout-btn").classList.add("hidden");
}

document.getElementById("auth-switch").addEventListener("click", () => {
  authMode = authMode === "login" ? "signup" : "login";
  document.getElementById("auth-submit").textContent =
    authMode === "login" ? "Log in" : "Create account";
  document.getElementById("auth-sub").textContent =
    authMode === "login" ? "Log in to manage your balance." : "Create an account to get started.";
  document.getElementById("auth-switch").textContent =
    authMode === "login" ? "Need an account? Sign up" : "Already have an account? Log in";
});

document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("auth-submit");
  const email = form.email.value.trim();
  const password = form.password.value;

  btn.disabled = true;
  btn.textContent = "Please wait\u2026";

  try {
    const { data, error } =
      authMode === "login"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });

    if (error) throw error;

    if (authMode === "signup" && !data.session) {
      showBanner("Check your email to confirm your account, then log in.", "success");
      authMode = "login";
      document.getElementById("auth-submit").textContent = "Log in";
      document.getElementById("auth-switch").textContent = "Need an account? Sign up";
      return;
    }

    currentSession = data.session;
    showApp();
    loadBalance();
    loadRecentDeposits();
  } catch (err) {
    showBanner(err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  currentSession = null;
  showAuth();
});

async function authHeaders(extra = {}) {
  const { data } = await sb.auth.getSession();
  currentSession = data.session;
  const token = currentSession ? currentSession.access_token : null;
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

sb.auth.onAuthStateChange((_event, session) => {
  currentSession = session;
  if (session) {
    showApp();
  } else {
    showAuth();
  }
});

// ---- Navigation ----
const screens = ["balance", "deposit", "withdraw", "history"];

function showScreen(name) {
  screens.forEach((s) => {
    document.getElementById(`screen-${s}`).classList.toggle("hidden", s !== name);
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === name);
  });

  if (name === "balance") { loadBalance(); loadRecentDeposits(); }
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
  setTimeout(() => banner.classList.add("hidden"), 5000);
}

// ---- API helper ----
async function apiFetch(path, options = {}) {
  const headers = await authHeaders(options.headers || {});
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
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

async function loadRecentDeposits() {
  const list = document.getElementById("recent-deposits");
  try {
    const deposits = await apiFetch("/deposits");
    if (!deposits.length) {
      list.innerHTML = `<li class="empty-row">No deposits yet</li>`;
      return;
    }
    list.innerHTML = deposits.slice(0, 3).map(depositRow).join("");
  } catch (err) {
    list.innerHTML = `<li class="empty-row">Couldn't load deposits</li>`;
  }
}

function depositRow(d) {
  const date = new Date(d.created_at).toLocaleDateString();
  return `<li>
    <div>
      <div class="row-amount">KES ${Number(d.amount).toLocaleString()}</div>
      <div class="row-meta">${date}</div>
    </div>
    <span class="status-pill status-${d.status}">${d.status}</span>
  </li>`;
}

function withdrawalRow(w) {
  const date = new Date(w.created_at).toLocaleDateString();
  const method = w.method === "mpesa" ? "M-Pesa" : (w.bank || "Bank");
  return `<li>
    <div>
      <div class="row-amount">KES ${Number(w.amount).toLocaleString()}</div>
      <div class="row-meta">${method} &middot; ${date}</div>
    </div>
    <span class="status-pill status-${w.status}">${w.status}</span>
  </li>`;
}

// ---- Deposit form ----
const fileInput = document.getElementById("receipt-input");
fileInput.addEventListener("change", () => {
  const label = document.getElementById("file-drop-text");
  label.textContent = fileInput.files[0] ? fileInput.files[0].name : "Choose an image or PDF";
});

document.getElementById("deposit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("deposit-submit");
  const formData = new FormData(form);

  btn.disabled = true;
  btn.textContent = "Submitting\u2026";

  try {
    const data = await apiFetch("/upload-receipt", { method: "POST", body: formData });
    showBanner(data.message || "Deposit submitted", "success");
    form.reset();
    document.getElementById("file-drop-text").textContent = "Choose an image or PDF";
    showScreen("balance");
  } catch (err) {
    showBanner(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit deposit";
  }
});

// ---- Withdraw form ----
document.querySelectorAll(".method-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".method-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const method = btn.dataset.method;
    document.getElementById("withdraw-method").value = method;
    document.getElementById("mpesa-fields").classList.toggle("hidden", method !== "mpesa");
    document.getElementById("bank-fields").classList.toggle("hidden", method !== "bank");
  });
});

document.getElementById("withdraw-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("withdraw-submit");
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  btn.disabled = true;
  btn.textContent = "Submitting\u2026";

  try {
    const data = await apiFetch("/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    showBanner(data.message || "Withdrawal requested", "success");
    form.reset();
    showScreen("balance");
  } catch (err) {
    showBanner(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Request withdrawal";
  }
});

// ---- History ----
let currentHistoryTab = "deposits";

document.querySelectorAll(".history-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".history-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentHistoryTab = tab.dataset.tab;
    loadHistory(currentHistoryTab);
  });
});

async function loadHistory(tab) {
  const list = document.getElementById("history-list");
  list.innerHTML = `<li class="empty-row">Loading\u2026</li>`;
  try {
    if (tab === "deposits") {
      const deposits = await apiFetch("/deposits");
      list.innerHTML = deposits.length
        ? deposits.map(depositRow).join("")
        : `<li class="empty-row">No deposits yet</li>`;
    } else {
      const withdrawals = await apiFetch("/withdrawals");
      list.innerHTML = withdrawals.length
        ? withdrawals.map(withdrawalRow).join("")
        : `<li class="empty-row">No withdrawals yet</li>`;
    }
  } catch (err) {
    list.innerHTML = `<li class="empty-row">Couldn't load history</li>`;
  }
}

// ---- Init ----
// Data loads automatically once onAuthStateChange fires with a session
// (see showApp(), triggered after login or on an existing session).
sb.auth.getSession().then(({ data }) => {
  currentSession = data.session;
  if (data.session) {
    showApp();
    loadBalance();
    loadRecentDeposits();
  } else {
    showAuth();
  }
});
