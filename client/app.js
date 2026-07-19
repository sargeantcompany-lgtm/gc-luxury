document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("enquiry-form");
const status = document.getElementById("form-status");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    fullName: form.fullName.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    message: form.message.value.trim(),
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
