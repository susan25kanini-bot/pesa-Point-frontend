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
        methodInput.value = selectedMethod;

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

      const formData = new FormData(withdrawForm);
      const payload = Object.fromEntries(formData.entries());

      try {
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

        alert("Withdrawal submitted successfully!");
        withdrawForm.reset();
      } catch (err) {
        alert(err.message);
      }
    });
  }
});
