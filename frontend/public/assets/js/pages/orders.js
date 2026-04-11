import { request } from "../modules/api.js";
import { requireAuth } from "../modules/auth.js";
import { formatCurrency, formatDate, showMessage } from "../modules/helpers.js";
import { mountShell, refreshCartBadge } from "../modules/layout.js";
import { publishOrderSync, subscribeToOrderSync } from "../modules/order-sync.js";

mountShell("/orders.html");

const pageMessage = document.querySelector("#page-message");
const ordersList = document.querySelector("#orders-list");
const ordersTitle = document.querySelector("[data-orders-title]");
const ordersEyebrow = document.querySelector("[data-orders-eyebrow]");
const user = await requireAuth();
let refreshTimeout;
let pollingInterval;
const ADMIN_ORDER_STATUSES = ["Placed", "Processing", "Shipped", "Delivered"];

if (user) {
  if (user.role === "admin") {
    if (ordersEyebrow) {
      ordersEyebrow.textContent = "Customer orders";
    }
    if (ordersTitle) {
      ordersTitle.textContent = "Customer purchases";
    }
  }
  await refreshCartBadge();
  await loadOrders();
  subscribeToRealtimeOrderUpdates();
}

function getStatusBadge(status) {
  const classes =
    status === "Cancelled"
      ? "bg-[#fee4e2] text-[#b42318]"
      : status === "Delivered"
        ? "bg-[#ecfdf3] text-[#027a48]"
        : status === "Shipped"
          ? "bg-[#eff6ff] text-[#1d4ed8]"
          : status === "Processing"
            ? "bg-[#fffaeb] text-[#b54708]"
            : "bg-[#f4f3ff] text-[#5925dc]";

  return `<span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${classes}">${status}</span>`;
}

function renderAdminDetails(order) {
  const address = order.shippingAddress || {};
  const addressLine = [address.line1, address.line2].filter(Boolean).join(", ");
  const localityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");

  return `
    <div class="mt-6 grid gap-4 lg:grid-cols-3">
      <article class="dashboard-tile">
        <p class="eyebrow">Customer details</p>
        <div class="mt-3 space-y-2 text-sm text-slate">
          <p class="text-base font-semibold text-ink">${order.userName || address.fullName || "Customer"}</p>
          <p>${order.userEmail || "Email not available"}</p>
          <p>${address.phone || "Phone not available"}</p>
        </div>
      </article>
      <article class="dashboard-tile">
        <p class="eyebrow">Shipping address</p>
        <div class="mt-3 space-y-2 text-sm text-slate">
          <p class="text-base font-semibold text-ink">${address.fullName || order.userName || "Customer"}</p>
          <p>${addressLine || "Address not available"}</p>
          <p>${localityLine || ""}</p>
          <p>${address.country || ""}</p>
        </div>
      </article>
      <article class="dashboard-tile">
        <p class="eyebrow">Order controls</p>
        <div class="mt-3 space-y-4">
          <div>
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Update status</label>
            <select class="field !min-h-[44px] !rounded-[16px] !bg-[#fffaf4] !py-2.5 text-sm" data-admin-order-status="${order.id}" ${order.status === "Cancelled" ? "disabled" : ""}>
              ${ADMIN_ORDER_STATUSES.map(
                (status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>`
              ).join("")}
            </select>
          </div>
          <div class="flex flex-wrap gap-3">
            <button class="btn-primary !px-4 !py-2.5 !text-sm" type="button" data-admin-save-status="${order.id}" ${order.status === "Cancelled" ? "disabled" : ""}>Save status</button>
            ${
              order.status !== "Cancelled" && order.status !== "Delivered"
                ? `<button class="btn-secondary !px-4 !py-2.5 !text-sm" type="button" data-admin-cancel-order="${order.id}">Cancel order</button>`
                : ""
            }
          </div>
        </div>
      </article>
    </div>
  `;
}

async function loadOrders() {
  try {
    const { orders } = await request("/orders", { auth: true });
    const visibleOrders = user.role === "admin" ? orders : orders.filter((order) => order.status !== "Cancelled");

    if (!visibleOrders.length) {
      ordersList.innerHTML = `
        <article class="promo-card p-8">
          <h2 class="text-2xl">${user.role === "admin" ? "No customer orders yet" : "No orders yet"}</h2>
          <a class="btn-primary mt-6 w-full sm:w-auto" href="${user.role === "admin" ? "/admin.html" : "/home.html"}">${user.role === "admin" ? "Back to admin" : "Browse products"}</a>
        </article>
      `;
      return;
    }

    ordersList.innerHTML = visibleOrders
      .map(
        (order) => `
          <article class="promo-card p-5 sm:p-6">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                ${user.role === "admin" ? `<p class="eyebrow">Customer</p><p class="mt-2 text-base font-semibold text-ink">${order.userName || "Customer"}</p>` : ""}
                <p class="eyebrow">Order status</p>
                <div class="mt-3">${getStatusBadge(order.status)}</div>
                <h2 class="mt-3 text-xl sm:text-2xl">Order #${order.id.slice(-6).toUpperCase()}</h2>
                <p class="mt-2 text-sm text-slate/80">${formatDate(order.createdAt)}</p>
              </div>
              <div class="text-left sm:text-right">
                <p class="text-sm text-slate/80">${order.paymentMethod}</p>
                <p class="mt-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white sm:inline-flex">${formatCurrency(order.totalAmount)}</p>
              </div>
            </div>
            <div class="mt-6 grid gap-4 sm:grid-cols-2">
              ${order.items
                .map(
                  (item) => `
                    <a class="dashboard-tile flex flex-col items-start gap-4 text-sm transition hover:border-sky/30 hover:bg-white sm:flex-row sm:items-center" href="/product.html?id=${item.productId}">
                      <img class="h-24 w-full rounded-[20px] object-cover sm:h-20 sm:w-20" src="${item.image}" alt="${item.name}" />
                      <div class="min-w-0 flex-1">
                        <p class="font-semibold text-ink">${item.name}</p>
                        <p class="mt-2 text-slate">Qty ${item.quantity}</p>
                        <p class="mt-1 text-slate">${formatCurrency(item.price)} each</p>
                      </div>
                    </a>
                  `
                )
                .join("")}
            </div>
            ${user.role === "admin" ? renderAdminDetails(order) : ""}
            ${
              user.role !== "admin" && order.status === "Placed"
                ? `
                  <div class="mt-5 flex justify-end">
                    <button class="btn-secondary w-full sm:w-auto" type="button" data-cancel-order="${order.id}">Cancel order</button>
                  </div>
                `
                : ""
            }
          </article>
        `
      )
      .join("");

    ordersList.querySelectorAll("[data-cancel-order]").forEach((button) => {
      button.addEventListener("click", async () => {
        const orderId = button.getAttribute("data-cancel-order");
        const confirmed = window.confirm("Cancel this order?");

        if (!confirmed) {
          return;
        }

        try {
          await request(`/orders/${orderId}/cancel`, {
            method: "PATCH",
            auth: true
          });

          publishOrderSync({ orderId, status: "Cancelled" });
          showMessage(pageMessage, "Order cancelled.", "success");
          await refreshCartBadge();
          await loadOrders();
        } catch (error) {
          showMessage(pageMessage, error.message);
        }
      });
    });

    if (user.role === "admin") {
      ordersList.querySelectorAll("[data-admin-save-status]").forEach((button) => {
        button.addEventListener("click", async () => {
          const orderId = button.getAttribute("data-admin-save-status");
          const select = ordersList.querySelector(`[data-admin-order-status="${orderId}"]`);

          if (!select) {
            return;
          }

          try {
            await request(`/orders/admin/${orderId}/status`, {
              method: "PATCH",
              auth: true,
              body: {
                status: select.value
              }
            });

            publishOrderSync({ orderId, status: select.value });
            showMessage(pageMessage, "Order status updated.", "success");
            await loadOrders();
          } catch (error) {
            showMessage(pageMessage, error.message);
          }
        });
      });

      ordersList.querySelectorAll("[data-admin-cancel-order]").forEach((button) => {
        button.addEventListener("click", async () => {
          const orderId = button.getAttribute("data-admin-cancel-order");
          const confirmed = window.confirm("Cancel this order?");

          if (!confirmed) {
            return;
          }

          try {
            await request(`/orders/admin/${orderId}/cancel`, {
              method: "PATCH",
              auth: true
            });

            publishOrderSync({ orderId, status: "Cancelled" });
            showMessage(pageMessage, "Order cancelled.", "success");
            await loadOrders();
          } catch (error) {
            showMessage(pageMessage, error.message);
          }
        });
      });
    }
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}

function subscribeToRealtimeOrderUpdates() {
  const refreshOrders = async () => {
    clearTimeout(refreshTimeout);
    refreshTimeout = window.setTimeout(async () => {
      await loadOrders();
    }, 250);
  };

  subscribeToOrderSync(refreshOrders);

  window.addEventListener("focus", refreshOrders);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshOrders();
    }
  });

  if (!pollingInterval) {
    pollingInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshOrders();
      }
    }, 8000);
  }
}
