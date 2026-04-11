import { request } from "../modules/api.js";
import { requireAuth } from "../modules/auth.js";
import { clearMessage, formatCurrency, showMessage } from "../modules/helpers.js";
import { mountShell, refreshCartBadge } from "../modules/layout.js";

mountShell("/cart.html");

const pageMessage = document.querySelector("#page-message");
const cartItems = document.querySelector("#cart-items");
const cartSummary = document.querySelector("#cart-summary");

const user = await requireAuth();

if (user) {
  await refreshCartBadge();
  await loadCart();
}

async function loadCart() {
  clearMessage(pageMessage);

  try {
    const cart = await request("/cart", { auth: true });
    renderCart(cart);
    await refreshCartBadge();
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}

function renderCart(cart) {
  if (!cart.items.length) {
    cartItems.innerHTML = `
      <article class="promo-card p-8">
        <h2 class="text-2xl">Your cart is empty</h2>
        <a class="btn-primary mt-6 w-full sm:w-auto" href="/home.html">Browse products</a>
      </article>
    `;
  } else {
    cartItems.innerHTML = cart.items
      .map(
        (item) => `
          <article class="promo-card flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:p-5">
            <img class="h-28 w-full rounded-[24px] object-cover sm:h-32 sm:w-36" src="${item.product.image}" alt="${item.product.name}" />
            <div class="flex-1">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p class="pill">${item.product.category}</p>
                  <h3 class="mt-3 text-xl sm:text-2xl">${item.product.name}</h3>
                  <p class="mt-2 text-sm text-slate">${formatCurrency(item.product.price)}</p>
                </div>
                <p class="price-tag">${formatCurrency(item.lineTotal)}</p>
              </div>
              <div class="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <input
                  class="field w-full max-w-full sm:max-w-[110px]"
                  data-quantity-input
                  data-product-id="${item.product.id}"
                  type="number"
                  min="1"
                  max="${item.product.stock}"
                  value="${item.quantity}"
                />
                <button class="btn-secondary w-full sm:w-auto" data-update-id="${item.product.id}">Update</button>
                <button class="btn-secondary w-full sm:w-auto" data-remove-id="${item.product.id}">Remove</button>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  }

  cartSummary.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <p class="eyebrow">Summary</p>
        <h2 class="mt-2 text-2xl">Order summary</h2>
      </div>
      <span class="accent-badge">Ready</span>
    </div>
    <div class="mt-6 space-y-4 text-sm text-slate">
      <div class="flex items-center justify-between">
        <span>Items</span>
        <span>${cart.itemCount}</span>
      </div>
      <div class="flex items-center justify-between">
        <span>Subtotal</span>
        <span>${formatCurrency(cart.subtotal)}</span>
      </div>
      <div class="flex items-center justify-between">
        <span>Shipping</span>
        <span>${cart.shippingFee === 0 ? "Free" : formatCurrency(cart.shippingFee)}</span>
      </div>
      <div class="flex items-center justify-between border-t border-mist pt-4 text-base font-semibold text-ink">
        <span>Total</span>
        <span>${formatCurrency(cart.total)}</span>
      </div>
    </div>
    <a class="btn-primary mt-8 w-full ${cart.items.length ? "" : "pointer-events-none opacity-50"}" href="/checkout.html">
      Proceed to checkout
    </a>
  `;

  document.querySelectorAll("[data-update-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = button.getAttribute("data-update-id");
      const input = document.querySelector(`[data-quantity-input][data-product-id="${productId}"]`);
      const quantity = Number(input?.value || 1);

      try {
        await request(`/cart/items/${productId}`, {
          method: "PATCH",
          auth: true,
          body: { quantity }
        });

        showMessage(pageMessage, "Cart updated.", "success");
        await loadCart();
      } catch (error) {
        showMessage(pageMessage, error.message);
      }
    });
  });

  document.querySelectorAll("[data-remove-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = button.getAttribute("data-remove-id");

      try {
        await request(`/cart/items/${productId}`, {
          method: "DELETE",
          auth: true
        });

        showMessage(pageMessage, "Item removed from cart.", "success");
        await loadCart();
      } catch (error) {
        showMessage(pageMessage, error.message);
      }
    });
  });
}
