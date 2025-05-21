document.addEventListener("DOMContentLoaded", () => {
  const user = localStorage.getItem("crm_user");
  if (!user && !window.location.pathname.endsWith("index.html")) {
    window.location.href = "index.html";
  }

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = `
      <nav>
        <h3>CRM Menu</h3>
        <ul>
          <li><a href="dashboard.html">Dashboard</a></li>
          <li><a href="leads.html">Leads</a></li>
          <li><a href="users.html">User Management</a></li>
          <li><a href="settings.html">Settings</a></li>
          <li><a href="reports.html">Reports</a></li>
          <li><a href="#" onclick="logout()">Logout</a></li>
        </ul>
      </nav>
    `;
  }
});

function logout() {
  localStorage.removeItem("crm_user");
  window.location.href = "index.html";
}
