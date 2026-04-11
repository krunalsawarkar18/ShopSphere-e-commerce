import { getQueryParam } from "../modules/helpers.js";
import { mountShell, refreshCartBadge } from "../modules/layout.js";
import { syncCurrentUser } from "../modules/auth.js";
import { request } from "../modules/api.js";

mountShell("");
await syncCurrentUser();
await refreshCartBadge();

const orderId = getQueryParam("orderId");
const sessionId = getQueryParam("session_id");
const copy = document.querySelector("#success-copy");

if (sessionId && copy) {
  copy.textContent = "Confirming your Pay Online order...";

  try {
    const data = await request(`/orders/checkout-session/${sessionId}/confirm`, {
      method: "POST",
      auth: true
    });

    await refreshCartBadge();
    copy.textContent = `Your order ${data.order.id.slice(-6).toUpperCase()} was paid securely and is now marked as placed.`;
  } catch (error) {
    copy.textContent = error.message;
  }
} else if (orderId && copy) {
  copy.textContent = `Your order ${orderId.slice(-6).toUpperCase()} is confirmed and now marked as placed.`;
}
