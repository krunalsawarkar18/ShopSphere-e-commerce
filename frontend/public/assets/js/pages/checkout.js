import { request } from "../modules/api.js";
import { requireAuth } from "../modules/auth.js";
import { clearMessage, formatCurrency, getQueryParam, showMessage } from "../modules/helpers.js";
import { mountShell, refreshCartBadge } from "../modules/layout.js";

mountShell("");

const pageMessage = document.querySelector("#page-message");
const checkoutSummary = document.querySelector("#checkout-summary");
const checkoutForm = document.querySelector("#checkout-form");
const paymentMethodSelect = document.querySelector("#paymentMethod");
const submitButton = document.querySelector("#checkout-submit");

const user = await requireAuth();

if (user) {
  await refreshCartBadge();
  prefillSavedAddress(user.savedAddress || {});
  await loadSummary();
  updateSubmitButtonLabel();

  if (getQueryParam("payment") === "cancelled") {
    showMessage(pageMessage, "Pay Online was cancelled. You can try again or choose Cash on Delivery.");
  }
}

paymentMethodSelect?.addEventListener("change", updateSubmitButtonLabel);

function prefillSavedAddress(address) {
  Object.entries(address).forEach(([key, value]) => {
    const field = checkoutForm?.querySelector(`[name="${key}"]`);

    if (field && value) {
      field.value = value;
    }
  });
}

function updateSubmitButtonLabel() {
  if (!submitButton || !paymentMethodSelect) {
    return;
  }

  submitButton.textContent = paymentMethodSelect.value === "Pay Online" ? "Pay Online" : "Place order";
}

async function loadSummary() {
  try {
    const cart = await request("/cart", { auth: true });

    if (!cart.items.length) {
      window.location.href = "/cart.html";
      return;
    }

    checkoutSummary.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <p class="eyebrow">Review</p>
          <h2 class="mt-2 text-2xl">Your cart</h2>
        </div>
        <span class="accent-badge">Final step</span>
      </div>
      <div class="mt-6 space-y-4">
        ${cart.items
          .map(
            (item) => `
              <div class="dashboard-tile text-sm">
                <div class="flex items-center gap-4">
                  <img class="h-16 w-16 rounded-[18px] object-cover sm:h-20 sm:w-20" src="${item.product.image}" alt="${item.product.name}" />
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div class="min-w-0">
                        <p class="truncate font-semibold text-ink">${item.product.name}</p>
                        <p class="text-slate">Qty ${item.quantity}</p>
                      </div>
                      <span class="font-medium text-ink">${formatCurrency(item.lineTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="mt-6 space-y-3 border-t border-mist pt-5 text-sm text-slate">
        <div class="flex items-center justify-between">
          <span>Subtotal</span>
          <span>${formatCurrency(cart.subtotal)}</span>
        </div>
        <div class="flex items-center justify-between text-base font-semibold">
          <span>Total</span>
          <span>${formatCurrency(cart.total)}</span>
        </div>
      </div>
    `;
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}

checkoutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(pageMessage);

  const formData = new FormData(checkoutForm);
  const shippingAddress = Object.fromEntries(formData.entries());
  const paymentMethod = formData.get("paymentMethod");

  try {
    submitButton?.setAttribute("disabled", "disabled");
    submitButton?.classList.add("opacity-70", "pointer-events-none");

    if (paymentMethod === "Pay Online") {
      const data = await request("/orders/checkout-session", {
        method: "POST",
        auth: true,
        body: { shippingAddress }
      });

      window.location.href = data.url;
      return;
    }

    const data = await request("/orders", {
      method: "POST",
      auth: true,
      body: {
        shippingAddress,
        paymentMethod
      }
    });

    await refreshCartBadge();
    window.location.href = `/success.html?orderId=${data.order.id}`;
  } catch (error) {
    showMessage(pageMessage, error.message);
  } finally {
    submitButton?.removeAttribute("disabled");
    submitButton?.classList.remove("opacity-70", "pointer-events-none");
  }
});
