document.addEventListener("DOMContentLoaded", () => {
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
  | SCREEN NAVIGATION
  |--------------------------------------------------------------------------
  */
  const navBtns = document.querySelectorAll("[data-nav]");
  const screens = document.querySelectorAll(".screen");

  navBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const targetNav = btn.dataset.nav;

      screens.forEach((screen) => screen.classList.add("hidden"));
      const targetScreen = document.getElementById(`screen-${targetNav}`);
      if (targetScreen) targetScreen.classList.remove("hidden");

      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      const activeBottomBtn = document.querySelector(`.nav-btn[data-nav="${targetNav}"]`);
      if (activeBottomBtn) activeBottomBtn.classList.add("active");
    });
  });

  /*
  |--------------------------------------------------------------------------
  | WITHDRAW FORM SUBMISSION
  |--------------------------------------------------------------------------
  */
  const withdrawForm = document.getElementById("withdraw-form");
  if (withdrawForm) {
    withdrawForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = withdrawForm.querySelector("button[type='submit']");
      const formData = new FormData(withdrawForm);
      const payload = Object.fromEntries(formData.entries());

      // Explicitly extract PayPal email input field if present
      const paypalEmailInput = document.getElementById("paypal-email") || document.querySelector("input[name='paypalEmail']");
      if (payload.method === "paypal" && paypalEmailInput) {
        payload.paypalEmail = paypalEmailInput.value.trim();
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = "Processing Withdrawal...";
        }

        const session = (await sb.auth.getSession()).data.session;
        if (!session) throw new Error("Please log in first.");

        const res = await fetch(`${RENDER_BACKEND_URL}/withdraw`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Withdrawal failed");

        if (payload.method === "paypal") {
          alert(`Instant PayPal payout successful! Sent $${data.amountUSD} USD.`);
        } else {
          alert("Withdrawal request submitted successfully!");
        }

        withdrawForm.reset();

        // Refresh balance on screen if function exists
        if (typeof fetchUserBalance === "function") {
          fetchUserBalance();
        }
      } catch (err) {
        alert(err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = "Withdraw";
        }
      }
    });
  }
});
