const scriptURL = 'https://script.google.com/macros/s/AKfycbyGSkfDfkhtluqeHaN-CpZ68z-RU_OhNzz_XD5UTTjlymX3YTkiYvfBoYmeIterQMIU/exec';

function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorMsg = document.getElementById("errorMsg");

  fetch(scriptURL, {
    method: "POST",
    body: JSON.stringify({
      type: "login",
      email: email,
      password: password
    }),
    headers: {
      "Content-Type": "application/json"
    }
  })
    .then(response => response.json())
    .then(result => {
      if (result.result === "success") {
        localStorage.setItem("crm_user", email);
        window.location.href = "dashboard.html";
      } else {
        errorMsg.textContent = result.message;
      }
    })
    .catch(() => {
      errorMsg.textContent = "Login failed. Please try again.";
    });
}
