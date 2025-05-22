document.addEventListener("DOMContentLoaded", async () => {
  const user = checkAuth(["Admin", "User"]);
  await loadLeads();
  document.getElementById("lead-form").addEventListener("submit", addLead);
});

async function loadLeads() {
  const res = await fetch(`${WORKER_URL}?sheet=Leads`);
  const rows = await res.json();

  const tableBody = document.getElementById("lead-table-body");
  tableBody.innerHTML = "";

  rows.slice(1).forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${row[0]}</td>
      <td>${row[1]}</td>
      <td>${row[2]}</td>
      <td>${row[3]}</td>
    `;
    tableBody.appendChild(tr);
  });
}

async function addLead(e) {
  e.preventDefault();
  const name = document.getElementById("lead-name").value;
  const email = document.getElementById("lead-email").value;
  const phone = document.getElementById("lead-phone").value;
  const source = document.getElementById("lead-source").value;

  const payload = {
    sheet: "Leads",
    data: [name, email, phone, source]
  };

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json();

  if (result.success) {
    alert("Lead added successfully");
    document.getElementById("lead-form").reset();
    loadLeads();
  } else {
    alert("Error adding lead");
  }
}
