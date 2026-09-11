// Run immediately to avoid missing DOMContentLoaded
(async () => {
  /*
  |--------------------------------------------------------------------------
  | CONFIGURATION & INITIALIZATION
  |--------------------------------------------------------------------------
  */
  const sb = supabase.createClient(
    'https://pykgpjgazcqugwwsaduz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5a2dwamdhemNxdWd3d3NhZHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQxMzEsImV4cCI6MjEwMjAyMDEzMX0.RvFvbAtv695HDPTM1N_p0SXLEISf4PrtO0a48nLybqE'
  );

  const RENDER_BACKEND_URL = "https://pesa-point-backned-1.onrender.com".replace(/\/$/, "");
  
  // Wait a split second for elements to render
  const authStatus = document.getElementById("authStatus");

  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;

    if (session) {
      if (authStatus) authStatus.innerText = "Connected";
      await fetchUserBalance(session.access_token);
    } else {
      if (authStatus) authStatus.innerText = "Not Logged In";
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    if (authStatus) authStatus.innerText = "Connection Error";
  }

  /*
  |--------------------------------------------------------------------------
  | METHOD TOGGLING (WITHDRAW SCREEN)
  |--------------------------------------------------------------------------
  */
  const methodBtns = document.querySelectorAll(".method-btn");
  const methodInput = document.getElementById("withdraw-method");
  const mpesaFields = document.getElementById("mpesa-fields");
  const bankFields = document.getElementById("bank-fields");
  const paypalFields = document.getElementById("paypal-fields");

  if (methodBtns.length > 0) {
    methodBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();

        methodBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const selectedMethod = btn.dataset.method;
        if (methodInput) methodInput.value = selectedMethod;

        if (mpesaFields) mpesaFields.classList.toggle("hidden", selectedMethod !== "mpesa");
        if (bankFields) bankFields.classList.toggle("hidden", selectedMethod !== "bank");
        if (paypalFields) paypalFields.classList.toggle("hidden", selectedMethod !== "paypal");
      });
    });
  }

  /*
  |--------------------------------------------------------------------------
  | FORM SUBMISSION (WITHDRAWAL REQUEST & PAYPAL INTEGRATION)
  |--------------------------------------------------------------------------
  */
  const withdrawForm = document.getElementById("withdraw-form");
  if (withdrawForm) {
    withdrawForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const { data: { session } } = await sb.auth.getSession();
      if (!session) return alert("Please log in to initiate a withdrawal.");

      const method = methodInput ? methodInput.value : "mpesa";
      const amount = document.getElementById("withdraw-amount")?.value;
      const paypalEmail = document.getElementById("paypal-email")?.value;

      if (method === "paypal" && (!paypalEmail || !paypalEmail.includes("@"))) {
        return alert("Please enter a valid PayPal email address.");
      }

      try {
        const response = await fetch(`${RENDER_BACKEND_URL}/withdraw`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            method: method,
            amount: Number(amount),
            details: method === "paypal" ? { email: paypalEmail } : {}
          })
        });

        const data = await response.json();
        if (response.ok) {
          alert("Withdrawal request processed successfully!");
          fetchUserBalance(session.access_token);
        } else {
          alert(`Error: ${data.error || "Withdrawal failed"}`);
        }
      } catch (err) {
        console.error("Withdrawal error:", err);
        alert("Failed to submit withdrawal request.");
      }
    });
  }

  /*
  |--------------------------------------------------------------------------
  | HELPER FUNCTIONS
  |--------------------------------------------------------------------------
  */
  async function fetchUserBalance(token) {
    try {
      const res = await fetch(`${RENDER_BACKEND_URL}/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok) {
        const balanceEl = document.getElementById("balance-value");
        if (balanceEl) balanceEl.innerText = data.balance.toLocaleString();
      }
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  }
})();
