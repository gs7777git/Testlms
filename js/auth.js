const SHEET_URL = "https://google-sheet-proxy.govindsaini355.workers.dev/";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value.trim();

    try {
      const res = await fetch(`${SHEET_URL}?sheet=Users&login=true&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
      const result = await res.json();

      if (result.success) {
        localStorage.setItem("user", JSON.stringify(result.user));

        // Role-based redirection
        const redirectPage = result.user.role === "Admin" ? "dashboard.html" : "leads.html";
        window.location.href = redirectPage;
      } else {
        alert("Login failed: " + (result.error || "Invalid credentials"));
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Network error. Please try again.");
    }
  });
});
