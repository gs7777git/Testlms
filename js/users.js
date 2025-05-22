const WORKER_URL = "https://google-sheet-proxy.govindsaini355.workers.dev/";

document.getElementById("addUserForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("userName").value;
  const email = document.getElementById("userEmail").value;
  const password = document.getElementById("userPassword").value;
  const role = document.getElementById("userRole").value;

  const user = { action: "addUser", name, email, password, role };

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });

    const result = await res.json();
    alert("User added successfully!");
    document.getElementById("addUserForm").reset();
    loadUsers(); // Reload user table
  } catch (error) {
    console.error("Error adding user:", error);
    alert("Error adding user. Check console.");
  }
});

async function loadUsers() {
  try {
    const res = await fetch(`${WORKER_URL}?action=getUsers`);
    const users = await res.json();

    const tbody = document.getElementById("usersTableBody");
    tbody.innerHTML = "";

    users.forEach((user, index) => {
      const row = `<tr>
        <td>${index + 1}</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
      </tr>`;
      tbody.insertAdjacentHTML("beforeend", row);
    });
  } catch (error) {
    console.error("Error loading users:", error);
  }
}

window.onload = loadUsers;
