const SHEET_URL = "https://google-sheet-proxy.govindsaini355.workers.dev/";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value.trim();

    try {
      const res = await fetch(`${SHEET_URL}?sheet=Users&login=true&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
      const result = await res.json();

      if (result.success) {
        localStorage.setItem("user", JSON.stringify(result.user));
        window.location.href = "dashboard.html";
      } else {
        alert("Login failed: " + result.error);
      }
    } catch (err) {
      alert("Network or server error.");
      console.error(err);
    }
  });
});
