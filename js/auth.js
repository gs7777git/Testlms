function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorMsg = document.getElementById("errorMsg");

  if (email === "admin@example.com" && password === "admin123") {
    localStorage.setItem("crm_user", email);
    window.location.href = "dashboard.html";
  } else {
    errorMsg.textContent = "Invalid credentials.";
  }
}

function logout() {
  localStorage.removeItem("crm_user");
  window.location.href = "index.html";
}
