const WORKER_URL = "https://google-sheet-proxy.govindsaini355.workers.dev/";

document.getElementById("leadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("leadName").value;
  const email = document.getElementById("leadEmail").value;
  const phone = document.getElementById("leadPhone").value;
  const status = document.getElementById("leadStatus").value;

  const lead = { action: "addLead", name, email, phone, status };

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });

    const result = await res.json();
    alert("Lead added successfully!");
    document.getElementById("leadForm").reset();
    loadLeads(); // Reload lead table
  } catch (error) {
    console.error("Error adding lead:", error);
    alert("Error adding lead. Check console.");
  }
});

async function loadLeads() {
  try {
    const res = await fetch(`${WORKER_URL}?action=getLeads`);
    const leads = await res.json();

    const tbody = document.getElementById("leadsTableBody");
    tbody.innerHTML = "";

    leads.forEach((lead, index) => {
      const row = `<tr>
        <td>${index + 1}</td>
        <td>${lead.name}</td>
        <td>${lead.email}</td>
        <td>${lead.phone}</td>
        <td>${lead.status}</td>
      </tr>`;
      tbody.insertAdjacentHTML("beforeend", row);
    });
  } catch (error) {
    console.error("Error loading leads:", error);
  }
}

window.onload = loadLeads;
