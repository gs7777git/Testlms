document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth(["Admin"]);
  await loadUsers();

  document.getElementById("user-form").addEventListener("submit", addUser);
});

async function loadUsers() {
  const res = await fetch(`${WORKER_URL}?sheet=Users`);
  const rows = await res.json();

  const tableBody = document.getElementById("user-table-body");
  tableBody.innerHTML = "";

  rows.slice(1).forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${row[0]}</td>
      <td>${row[1]}</td>
      <td>${row[3]}</td>
    `;
    tableBody.appendChild(tr);
  });
}

async function addUser(e) {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  const payload = {
    sheet: "Users",
    data: [name, email, password, role]
  };

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json();

  if (result.success) {
    alert("User added successfully");
    document.getElementById("user-form").reset();
    loadUsers();
  } else {
    alert("Error adding user");
  }
}
