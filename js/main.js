
if (!localStorage.getItem("crm_user")) {
  window.location.href = "index.html";
}

fetch("components/sidebar.html")
  .then(res => res.text())
  .then(html => {
    document.getElementById("sidebar").innerHTML = html;
  });
