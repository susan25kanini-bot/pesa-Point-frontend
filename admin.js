// ---- Configuration ----
const API_BASE = RENDER_BACKEND_URL;

// The admin key is kept only in memory (a JS variable) for this page
// session — never written to localStorage, so it doesn't persist if the
// tab is closed. You'll re-enter it each time you open this page.
let adminKey = null;
let currentType = "withdrawal";   // "withdrawal" or "deposit"
let currentStatus = "pending";

// Maps the request type to its API path segment ("withdrawal" -> "withdrawals").
function endpointFor(type) {
  return type === "deposit" ? "deposits" : "withdrawals";
}

// ---- Login ----
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("admin-key-input");
  const key = input.value.trim();

  if (!key) return;

  // Verify the key actually works before switching screens, by making a
  // real request rather than just trusting whatever was typed.
  try {
    const res = await fetch(`${API_BASE}/admin/withdrawals?status=pending`, {
      headers: { "x-admin-key": key }
    });

    if (res.status === 401) {
      showBanner("Incorrect admin key.", "error");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showBanner(data.error || "Login failed.", "error");
      return;
    }

    adminKey = key;
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("requests-screen").classList.remove("hidden");
    document.getElementById("connStatus").textContent = "Logged in";
    loadRequests();
  } catch (err) {
    showBanner("Could not reach the server. " + err.message, "error");
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  adminKey = null;
  document.getElementById("admin-key-input").value = "";
  document.getElementById("requests-screen").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("connStatus").textContent = "";
});

// ---- Banner ----
function showBanner(message, type) {
  const banner = document.getElementById("banner");
  banner.textContent = message;
  banner.className = `banner ${type}`;
  banner.classList.remove("hidden");
  setTimeout(() => banner.classList.add("hidden"), 5000);
}

// ---- Type tabs (Withdrawals / Deposits) ----
document.querySelectorAll(".type-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".type-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentType = tab.dataset.type;
    // CSV export only makes sense for withdrawals — that's what banks/
    // M-Pesa bulk payment portals accept.
    document.getElementById("export-csv-btn").classList.toggle("hidden", currentType !== "withdrawal");
    loadRequests();
  });
});

// ---- Status tabs ----
document.querySelectorAll(".status-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".status-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStatus = btn.dataset.status;
    loadRequests();
  });
});

document.getElementById("refresh-btn").addEventListener("click", loadRequests);

// ---- CSV export (for bulk upload to your bank or M-Pesa Business Hub) ----
document.getElementById("export-csv-btn").addEventListener("click", async () => {
  const btn = document.getElementById("export-csv-btn");
  btn.disabled = true;
  btn.textContent = "Preparing\u2026";

  try {
    const res = await fetch(`${API_BASE}/admin/withdrawals/export-csv?status=${currentStatus}`, {
      headers: { "x-admin-key": adminKey }
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to export CSV.");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pesa-points-payouts-${currentStatus}-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    showBanner(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Download CSV";
  }
});

// ---- Load & render requests ----
async function loadRequests() {
  const list = document.getElementById("requests-list");
  list.innerHTML = `<p class="empty-row">Loading&hellip;</p>`;

  try {
    const res = await fetch(`${API_BASE}/admin/${endpointFor(currentType)}?status=${currentStatus}`, {
      headers: { "x-admin-key": adminKey }
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Failed to load ${currentType}s.`);
    }

    const requests = await res.json();

    if (!requests.length) {
      list.innerHTML = `<p class="empty-row">No ${currentStatus} ${currentType}s.</p>`;
      return;
    }

    list.innerHTML = requests.map(requestCard).join("");

    // Wire up action buttons after rendering, since they're built from
    // template strings rather than addEventListener at creation time.
    document.querySelectorAll(".approve-btn").forEach((btn) => {
      btn.addEventListener("click", () => actOnRequest(btn.dataset.id, "approve"));
    });
    document.querySelectorAll(".reject-btn").forEach((btn) => {
      btn.addEventListener("click", () => actOnRequest(btn.dataset.id, "reject"));
    });
  } catch (err) {
    list.innerHTML = `<p class="empty-row">Couldn't load ${currentType}s.</p>`;
    showBanner(err.message, "error");
  }
}

function requestCard(r) {
  const date = new Date(r.created_at).toLocaleString();

  // Withdrawal method may be stored as "mpesa:0712345678" or
  // "paypal:user@example.com" — split it apart so the admin can see
  // exactly where the money will go before approving.
  const baseMethod = r.method || "";
  const destination = r.destination || "";
  const methodLabel = { mpesa: "M-Pesa", paypal: "PayPal", manual: "Manual" }[baseMethod] || baseMethod;
  const approveLabel = currentType === "deposit"
    ? "Approve (received)"
    : (baseMethod === "manual" ? "Approve (already paid)" : `Approve (send via ${methodLabel})`);

  const actions = r.status === "pending"
    ? `<div class="w-actions">
         <button type="button" class="approve-btn" data-id="${r.id}">${approveLabel}</button>
         <button type="button" class="reject-btn" data-id="${r.id}">Reject</button>
       </div>`
    : "";

  const destinationRow = destination ? `<div>Sending to: <b>${destination}</b></div>` : "";

  return `<div class="w-card">
    <div class="w-top">
      <span class="w-amount">KES ${Number(r.amount).toLocaleString()}</span>
      <span class="w-status status-${r.status}">${r.status}</span>
    </div>
    <div class="w-meta">
      <div>Method: ${methodLabel}</div>
      ${destinationRow}
      <div>Requested: ${date}</div>
      <div>ID: ${r.id}</div>
    </div>
    ${actions}
  </div>`;
}

// ---- Approve / reject ----
async function actOnRequest(id, action) {
  let verb;

  if (currentType === "deposit") {
    verb = action === "approve" ? "confirm you received this deposit and credit the balance" : "reject this deposit";
  } else if (action === "approve") {
    verb = "approve this — if the method is M-Pesa or PayPal, this will send a REAL PAYOUT right now";
  } else {
    verb = "reject and refund this";
  }

  if (!confirm(`Are you sure you want to ${verb}? This cannot be undone.`)) return;

  const buttons = document.querySelectorAll(`[data-id="${id}"]`);
  buttons.forEach((b) => (b.disabled = true));

  try {
    const res = await fetch(`${API_BASE}/admin/${endpointFor(currentType)}/${id}/${action}`, {
      method: "POST",
      headers: { "x-admin-key": adminKey }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Failed to ${action} ${currentType}.`);
    }

    showBanner(data.message || `${currentType} ${action}d.`, "success");
    loadRequests();
  } catch (err) {
    showBanner(err.message, "error");
    buttons.forEach((b) => (b.disabled = false));
  }
}
