const SHEET_URL = "https://google-sheet-proxy.govindsaini355.workers.dev/";

document.getElementById("leadForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const params = new URLSearchParams();
  formData.forEach((value, key) => {
    params.append(key, value);
  });

  try {
    const res = await fetch(`${SHEET_URL}?sheet=Leads&${params.toString()}`);
    const result = await res.json();

    if (result.success) {
      alert("Lead added successfully!");
      e.target.reset();
    } else {
      alert("Failed to add lead: " + result.error);
    }
  } catch (err) {
    console.error("Error submitting lead:", err);
    alert("Submission failed.");
  }
});
