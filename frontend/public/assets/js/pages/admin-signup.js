import { request } from "../modules/api.js";
import { bootstrapShell } from "../modules/bootstrap.js";
import { clearMessage, showMessage } from "../modules/helpers.js";
import { saveSession } from "../modules/storage.js";

bootstrapShell("");

const form = document.querySelector("#admin-signup-form");
const message = document.querySelector("#form-message");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(message);

  const formData = new FormData(form);
  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString().trim();

  if (!password || password.length < 6) {
    showMessage(message, "Password must be at least 6 characters long.");
    return;
  }

  try {
    const data = await request("/auth/admin/signup", {
      method: "POST",
      body: { name, email, password }
    });

    saveSession(data.token, data.user);
    window.location.href = "/admin.html";
  } catch (error) {
    showMessage(message, error.message);
  }
});
