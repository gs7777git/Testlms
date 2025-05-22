const WORKER_URL = "https://googlesheet-proxy.govindsaini355.workers.dev/";

async function login(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const res = await fetch(`${WORKER_URL}?sheet=Users&login=true&email=${email}&password=${password}`);
  const data = await res.json();

  if (data.success) {
    localStorage.setItem("user", JSON.stringify(data.user));

    if (data.user.role === "Admin") {
      window.location.href = "dashboard.html";
    } else if (data.user.role === "User") {
      window.location.href = "leads.html";
    } else {
      alert("Unknown role: " + data.user.role);
    }
  } else {
    alert("Login failed: Invalid credentials");
  }
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

function checkAuth(allowedRoles) {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || !allowedRoles.includes(user.role)) {
    alert("Unauthorized. Redirecting to login.");
    window.location.href = "index.html";
  }
  return user;
}
