const SHEET_URL = "https://google-sheet-proxy.govindsaini355.workers.dev/";

async function loadLeads() {
  try {
    const res = await fetch(`${SHEET_URL}?sheet=Leads`);
    const leads = await res.json();

    const tableBody = document.querySelector("#leadsTable tbody");
    tableBody.innerHTML = "";

    leads.forEach(lead => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${lead.name || ""}</td>
        <td>${lead.email || ""}</td>
        <td>${lead.phone || ""}</td>
        <td>${lead.status || ""}</td>
        <td>${lead.source || ""}</td>
        <td>${lead.date || ""}</td>
      `;
      tableBody.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading leads:", err);
    alert("Failed to load leads.");
  }
}

document.addEventListener("DOMContentLoaded", loadLeads);
