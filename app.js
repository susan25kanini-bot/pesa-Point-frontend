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
  const authStatus = document.getElementById("authStatus");

  // Set status directly to ready without checking login
  if (authStatus) authStatus.innerText = "Ready";
  fetchDefaultBalance();

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
            "Content-Type": "application/json"
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
          fetchDefaultBalance();
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
  async function fetchDefaultBalance() {
    try {
      const res = await fetch(`${RENDER_BACKEND_URL}/balance`);
      const data = await res.json();

      if (res.ok) {
        const balanceEl = document.getElementById("balance-value");
        if (balanceEl) balanceEl.innerText = (data.balance || 0).toLocaleString();
      }
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  }
})();
