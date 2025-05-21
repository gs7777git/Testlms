const scriptURL = 'https://script.google.com/macros/s/AKfycbyGSkfDfkhtluqeHaN-CpZ68z-RU_OhNzz_XD5UTTjlymX3YTkiYvfBoYmeIterQMIU/exec';

const form = document.getElementById("leadForm");
const tableBody = document.querySelector("#leadsTable tbody");

form.addEventListener("submit", function (e) {
  e.preventDefault();

  const lead = {
    type: "add-lead",
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    source: document.getElementById("source").value,
    status: document.getElementById("status").value,
    notes: document.getElementById("notes").value
  };

  fetch(scriptURL, {
    method: "POST",
    body: JSON.stringify(lead),
    headers: {
      "Content-Type": "application/json"
    }
  })
    .then(res => res.json())
    .then(res => {
      if (res.result === "success") {
        alert("Lead added successfully!");
        form.reset();
        loadLeads();
      } else {
        alert("Error: " + res.message);
      }
    })
    .catch(() => {
      alert("Failed to add lead. Please try again.");
    });
});

function loadLeads() {
  fetch(scriptURL)
    .then(response => response.json())
    .then(data => {
      tableBody.innerHTML = "";
      data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.Timestamp || ''}</td>
          <td>${row.Name || ''}</td>
          <td>${row.Email || ''}</td>
          <td>${row.Phone || ''}</td>
          <td>${row.Source || ''}</td>
          <td>${row.Status || ''}</td>
          <td>${row.Notes || ''}</td>
        `;
        tableBody.appendChild(tr);
      });
    })
    .catch(() => {
      tableBody.innerHTML = "<tr><td colspan='7'>Error loading leads.</td></tr>";
    });
}

// Auto-load leads on page load
document.addEventListener("DOMContentLoaded", loadLeads);
