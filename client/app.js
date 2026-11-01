document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("enquiry-form");
const status = document.getElementById("form-status");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Not every form has every field (appraisal.html has an address instead of price/locations).
  const val = (name) => (form.elements[name] ? form.elements[name].value.trim() : "");

  // appraisal.html tags its enquiries so they're recognisable in the CRM notes.
  const lead = [form.dataset.subject, val("address") && `Address: ${val("address")}`].filter(Boolean);

  const payload = {
    fullName: val("fullName"),
    email: val("email"),
    phone: val("phone"),
    propertyType: val("propertyType"),
    priceRange: val("priceRange"),
    locations: val("locations"),
    message: [...lead, val("message")].filter(Boolean).join("\n"),
  };

  const submitBtn = form.querySelector(".submit-btn");
  submitBtn.disabled = true;
  status.textContent = "";
  status.className = "form-status";

  try {
    const response = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Request failed");
    }

    status.textContent = "Thank you. Your enquiry has been received — we will be in touch shortly.";
    status.classList.add("success");
    form.reset();
  } catch (err) {
    status.textContent = "Something went wrong. Please try again or contact us directly.";
    status.classList.add("error");
  } finally {
    submitBtn.disabled = false;
  }
});
