import { request } from "../modules/api.js";
import { clearMessage, showMessage } from "../modules/helpers.js";
import { mountShell, refreshCartBadge } from "../modules/layout.js";
import { saveSession } from "../modules/storage.js";
import { syncCurrentUser } from "../modules/auth.js";

mountShell("");
await syncCurrentUser();
await refreshCartBadge();

const form = document.querySelector("#admin-login-form");
const message = document.querySelector("#form-message");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(message);

  const formData = new FormData(form);
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString().trim();

  try {
    const data = await request("/auth/admin/login", {
      method: "POST",
      body: { email, password }
    });

    saveSession(data.token, data.user);
    const next = new URLSearchParams(window.location.search).get("next") || "/admin.html";
    window.location.href = next;
  } catch (error) {
    showMessage(message, error.message);
  }
});
