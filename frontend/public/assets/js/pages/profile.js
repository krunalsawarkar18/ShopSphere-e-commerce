import { request } from "../modules/api.js";
import { requireAuth } from "../modules/auth.js";
import { formatCurrency, formatDate, showMessage } from "../modules/helpers.js";
import { getFavoriteCount } from "../modules/favorites.js";
import { mountShell, refreshCartBadge } from "../modules/layout.js";
import { getToken, saveSession } from "../modules/storage.js";

mountShell("");

const pageMessage = document.querySelector("#page-message");
const profileCard = document.querySelector("#profile-card");
const profileAddress = document.querySelector("#profile-address");
const profileStats = document.querySelector("#profile-stats");
const profileOrders = document.querySelector("#profile-orders");

const user = await requireAuth();

if (user) {
  await refreshCartBadge();
  await loadProfile(user);
}

async function loadProfile(userData) {
  try {
    const [cart, { orders }] = await Promise.all([request("/cart", { auth: true }), request("/orders", { auth: true })]);
    const address = userData.savedAddress || {};
    const hasSavedAddress = Boolean(address.fullName || address.line1 || address.city || address.phone);

    profileCard.innerHTML = `
      <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span class="flex h-16 w-16 items-center justify-center rounded-full bg-sky text-2xl font-heading font-bold text-white">
          ${userData.name.charAt(0).toUpperCase()}
        </span>
        <div>
          <p class="eyebrow">Signed in as</p>
          <h2 class="mt-2 text-3xl">${userData.name}</h2>
          <p class="mt-2 text-sm text-slate">${userData.email}</p>
        </div>
      </div>
    `;

    profileAddress.innerHTML = `
      <div class="section-head">
        <div>
          <p class="eyebrow">Saved address</p>
          <h2 class="mt-2 text-2xl">Delivery address</h2>
        </div>
        <button id="toggle-address-edit" class="chip-link w-full justify-center sm:w-auto" type="button">${hasSavedAddress ? "Edit address" : "Save address"}</button>
      </div>
      <div id="saved-address-view" class="${hasSavedAddress ? "mt-5" : "mt-5 hidden"}">
        <div class="dashboard-tile">
          <p class="text-base font-semibold text-ink">${address.fullName || "No saved address yet"}</p>
          <div class="mt-3 space-y-1 text-sm text-slate">
            <p>${address.phone || ""}</p>
            <p>${address.line1 || ""}${address.line2 ? `, ${address.line2}` : ""}</p>
            <p>${[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</p>
            <p>${address.country || ""}</p>
          </div>
        </div>
      </div>
      <form id="address-form" class="mt-5 grid gap-4 ${hasSavedAddress ? "hidden" : ""}">
        <div class="grid gap-4 sm:grid-cols-2">
          <input class="field" name="fullName" placeholder="Full name" value="${address.fullName || ""}" required />
          <input class="field" name="phone" placeholder="Phone" value="${address.phone || ""}" required />
        </div>
        <input class="field" name="line1" placeholder="Address line 1" value="${address.line1 || ""}" required />
        <input class="field" name="line2" placeholder="Address line 2" value="${address.line2 || ""}" />
        <div class="grid gap-4 sm:grid-cols-2">
          <input class="field" name="city" placeholder="City" value="${address.city || ""}" required />
          <input class="field" name="state" placeholder="State" value="${address.state || ""}" required />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <input class="field" name="postalCode" placeholder="Postal code" value="${address.postalCode || ""}" required />
          <input class="field" name="country" placeholder="Country" value="${address.country || "India"}" required />
        </div>
        <div class="flex flex-wrap gap-3">
          <button class="btn-primary" type="submit">Save address</button>
          <button id="cancel-address-edit" class="btn-secondary ${hasSavedAddress ? "" : "hidden"}" type="button">Cancel</button>
        </div>
      </form>
    `;

    profileStats.innerHTML = `
      <div class="section-head">
        <div>
          <p class="eyebrow">Overview</p>
          <h2 class="mt-2 text-2xl">Account stats</h2>
        </div>
      </div>
      <div class="mt-5 grid gap-4 sm:grid-cols-3">
        <div class="mini-stat">
          <p class="text-sm font-semibold text-ink">Orders</p>
          <p class="mt-2 text-2xl font-heading text-ink">${orders.length}</p>
        </div>
        <div class="mini-stat">
          <p class="text-sm font-semibold text-ink">Cart items</p>
          <p class="mt-2 text-2xl font-heading text-ink">${cart.itemCount}</p>
        </div>
        <div class="mini-stat">
          <p class="text-sm font-semibold text-ink">Favourites</p>
          <p class="mt-2 text-2xl font-heading text-ink">${getFavoriteCount()}</p>
        </div>
      </div>
    `;

    const latestOrder = orders[0];

    profileOrders.innerHTML = latestOrder
      ? `
        <div class="section-head">
          <div>
            <p class="eyebrow">Latest order</p>
            <h2 class="mt-2 text-2xl">Order #${latestOrder.id.slice(-6).toUpperCase()}</h2>
          </div>
          <span class="pill">${latestOrder.status}</span>
        </div>
        <div class="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <img class="h-24 w-full rounded-[20px] object-cover sm:h-20 sm:w-20" src="${latestOrder.items[0].image}" alt="${latestOrder.items[0].name}" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-ink">${latestOrder.items[0].name}</p>
            <p class="mt-2 text-sm text-slate">${formatDate(latestOrder.createdAt)}</p>
            <p class="mt-1 text-sm text-slate">${formatCurrency(latestOrder.totalAmount)}</p>
          </div>
        </div>
      `
      : `
        <div class="section-head">
          <div>
            <p class="eyebrow">Latest order</p>
            <h2 class="mt-2 text-2xl">No orders yet</h2>
          </div>
        </div>
        <a class="btn-primary mt-5 w-full sm:w-auto" href="/home.html">Start shopping</a>
      `;

    bindAddressEvents(userData);
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}

function bindAddressEvents(userData) {
  const toggleButton = document.querySelector("#toggle-address-edit");
  const cancelButton = document.querySelector("#cancel-address-edit");
  const form = document.querySelector("#address-form");
  const savedView = document.querySelector("#saved-address-view");

  const showForm = () => {
    form?.classList.remove("hidden");
    savedView?.classList.add("hidden");
  };

  const showSavedView = () => {
    if (savedView?.textContent.trim()) {
      savedView.classList.remove("hidden");
    }
    form?.classList.add("hidden");
  };

  toggleButton?.addEventListener("click", showForm);
  cancelButton?.addEventListener("click", showSavedView);

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const data = await request("/auth/address", {
        method: "PATCH",
        auth: true,
        body: payload
      });

      if (getToken()) {
        saveSession(getToken(), data.user);
      }

      showMessage(pageMessage, "Address saved successfully.", "success");
      await loadProfile(data.user);
    } catch (error) {
      showMessage(pageMessage, error.message);
    }
  });
}
