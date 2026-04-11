import { request } from "../modules/api.js";
import { syncCurrentUser } from "../modules/auth.js";
import { clearMessage, showMessage } from "../modules/helpers.js";
import { mountShell, refreshCartBadge } from "../modules/layout.js";
import { publishOrderSync, subscribeToOrderSync } from "../modules/order-sync.js";

mountShell("/admin.html");
const currentUser = await syncCurrentUser();
await refreshCartBadge();

const pageMessage = document.querySelector("#admin-message");
const authGate = document.querySelector("#admin-auth-gate");
const dashboard = document.querySelector("#admin-dashboard");
const metricsWrap = document.querySelector("#admin-metrics");
const analyticsWrap = document.querySelector("#admin-analytics");
const recentOrdersWrap = document.querySelector("#admin-recent-orders");
const topProductsWrap = document.querySelector("#admin-top-products");
const orderModal = document.querySelector("#admin-order-modal");
const orderModalBody = document.querySelector("#admin-order-modal-body");
const orderModalClose = document.querySelector("#admin-order-modal-close");
const alertsWrap = document.querySelector("#admin-alerts");
const performanceWrap = document.querySelector("#admin-performance");
const productsWrap = document.querySelector("#admin-products");
const categoriesWrap = document.querySelector("#admin-categories");
const inventoryStatus = document.querySelector("#inventory-status");
const form = document.querySelector("#product-form");
const formTitle = document.querySelector("#product-form-title");
const submitLabel = document.querySelector("#product-submit-label");
const cancelEditButton = document.querySelector("#cancel-edit");

let productCache = [];
let recentOrdersCache = [];
let adminRefreshTimeout;
let adminPollingInterval;
const ADMIN_ORDER_STATUSES = ["Placed", "Processing", "Shipped", "Delivered"];

function formatInr(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatCompactDate(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short"
  });
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

function showAdminGate() {
  authGate.classList.remove("hidden");
  dashboard.classList.add("hidden");
}

function showDashboard() {
  authGate.classList.add("hidden");
  dashboard.classList.remove("hidden");
}

function closeOrderModal() {
  if (!orderModal) {
    return;
  }

  orderModal.classList.add("hidden");
  orderModal.classList.remove("flex");
  orderModal.setAttribute("aria-hidden", "true");
}

function openOrderModal(order) {
  if (!orderModal || !orderModalBody) {
    return;
  }

  const address = order.shippingAddress || {};

  orderModalBody.innerHTML = `
    <div class="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
      <article class="section-surface !p-4 sm:!p-6">
        <div class="section-head">
          <div>
            <p class="eyebrow">Customer</p>
            <h3 class="mt-2 text-xl sm:text-2xl">${order.userName || "Customer"}</h3>
          </div>
          <div class="flex flex-wrap justify-end gap-2">
            ${getStatusBadge(order.status)}
            ${
              order.status !== "Cancelled" && order.status !== "Delivered"
                ? `<button class="btn-secondary !px-4 !py-2" type="button" data-admin-cancel-order="${order.id}">Cancel order</button>`
                : ""
            }
          </div>
        </div>
        <div class="mt-4 grid gap-3 sm:mt-5 sm:gap-4 sm:grid-cols-2">
          <div class="dashboard-tile !p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Email</p>
            <p class="mt-2 break-all text-sm font-semibold text-ink">${order.userEmail || "Not available"}</p>
          </div>
          <div class="dashboard-tile !p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Order status</p>
            <div class="mt-2">${getStatusBadge(order.status)}</div>
          </div>
          <div class="dashboard-tile !p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Update status</p>
            <div class="mt-3 flex flex-col gap-3 sm:flex-row">
              <select class="field !min-h-[44px] !rounded-[16px] !bg-[#fffaf4] !py-2.5 text-sm" data-admin-status-select>
                ${ADMIN_ORDER_STATUSES.map(
                  (status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>`
                ).join("")}
              </select>
              <button class="btn-primary !px-4 !py-2.5 !text-sm" type="button" data-admin-status-save="${order.id}" ${
                order.status === "Cancelled" ? "disabled" : ""
              }>
                Save status
              </button>
            </div>
          </div>
          <div class="dashboard-tile !p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Payment</p>
            <p class="mt-2 text-sm font-semibold text-ink">${order.paymentMethod || "Cash on Delivery"}</p>
          </div>
          <div class="dashboard-tile !p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Order date</p>
            <p class="mt-2 text-sm font-semibold text-ink">${new Date(order.createdAt).toLocaleString("en-IN")}</p>
          </div>
          <div class="dashboard-tile !p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Total</p>
            <p class="mt-2 text-sm font-semibold text-ink">${formatInr(order.totalAmount)}</p>
          </div>
        </div>
        <article class="dashboard-tile mt-4 !p-4 sm:mt-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Shipping address</p>
          <div class="mt-3 space-y-1 text-sm text-slate">
            <p class="font-semibold text-ink">${address.fullName || order.userName || "Customer"}</p>
            <p>${address.phone || "Phone not provided"}</p>
            <p>${address.line1 || ""}${address.line2 ? `, ${address.line2}` : ""}</p>
            <p>${[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</p>
            <p>${address.country || ""}</p>
          </div>
        </article>
      </article>

      <article class="section-surface !p-4 sm:!p-6">
        <div class="section-head">
          <div>
            <p class="eyebrow">Products</p>
            <h3 class="mt-2 text-xl sm:text-2xl">Ordered items</h3>
          </div>
          <span class="ghost-tag">${order.items?.length || 0} items</span>
        </div>
        <div class="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
          ${(order.items || [])
            .map(
              (item) => `
                <a class="dashboard-tile flex flex-col gap-4 !p-4 transition hover:-translate-y-0.5 sm:flex-row sm:items-center" href="/product.html?id=${item.productId}">
                  <img class="h-20 w-20 rounded-[18px] object-cover" src="${item.image}" alt="${item.name}" />
                  <div class="min-w-0 flex-1">
                    <p class="line-clamp-2 text-base font-semibold text-ink">${item.name}</p>
                    <p class="mt-1 text-sm text-slate">Qty ${item.quantity}</p>
                    <p class="mt-2 text-sm font-semibold text-ink">${formatInr(item.price)}</p>
                  </div>
                  <span class="price-tag self-start sm:self-auto">${formatInr(item.price * item.quantity)}</span>
                </a>
              `
            )
            .join("")}
        </div>
      </article>
    </div>
  `;

  orderModal.classList.remove("hidden");
  orderModal.classList.add("flex");
  orderModal.setAttribute("aria-hidden", "false");

  orderModalBody.querySelector("[data-admin-cancel-order]")?.addEventListener("click", async () => {
    const confirmed = window.confirm("Cancel this order?");

    if (!confirmed) {
      return;
    }

    try {
      await request(`/orders/admin/${order.id}/cancel`, {
        method: "PATCH",
        auth: true
      });

      publishOrderSync({ orderId: order.id, status: "Cancelled" });
      showMessage(pageMessage, "Order cancelled.", "success");
      closeOrderModal();
      await loadAdminDashboard();
    } catch (error) {
      showMessage(pageMessage, error.message);
    }
  });

  orderModalBody.querySelector("[data-admin-status-save]")?.addEventListener("click", async () => {
    const select = orderModalBody.querySelector("[data-admin-status-select]");

    if (!select) {
      return;
    }

    try {
      await request(`/orders/admin/${order.id}/status`, {
        method: "PATCH",
        auth: true,
        body: {
          status: select.value
        }
      });

      publishOrderSync({ orderId: order.id, status: select.value });
      showMessage(pageMessage, "Order status updated.", "success");
      closeOrderModal();
      await loadAdminDashboard();
    } catch (error) {
      showMessage(pageMessage, error.message);
    }
  });
}

function resetForm() {
  form?.reset();
  if (form) {
    form.dataset.editingId = "";
  }
  formTitle.textContent = "Add product";
  submitLabel.textContent = "Add product";
  cancelEditButton.classList.add("hidden");
}

function fillForm(product) {
  form.dataset.editingId = product.id;
  form.name.value = product.name;
  form.price.value = product.price;
  form.image.value = product.image;
  form.category.value = product.category;
  form.stock.value = product.stock;
  form.description.value = product.description;
  formTitle.textContent = "Update product";
  submitLabel.textContent = "Save changes";
  cancelEditButton.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMetrics(products, categories) {
  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = products.filter((product) => product.stock <= 12).length;
  const avgPrice = products.length
    ? Math.round(products.reduce((sum, product) => sum + product.price, 0) / products.length)
    : 0;

  const cards = [
    { label: "Products", value: products.length, tone: "bg-sky text-white" },
    { label: "Categories", value: categories.length, tone: "bg-ink text-white" },
    { label: "Units in stock", value: totalStock, tone: "bg-apricot text-white" },
    { label: "Low stock", value: lowStock || 0, tone: "bg-[#355a4a] text-white", subValue: `Avg price Rs ${avgPrice}` }
  ];

  metricsWrap.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card p-4 sm:p-6">
          <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${card.tone}">
            ${card.label}
          </span>
          <h2 class="mt-3 text-2xl text-ink sm:mt-4 sm:text-4xl">${card.value}</h2>
          ${card.subValue ? `<p class="mt-2 text-sm text-slate">${card.subValue}</p>` : ""}
        </article>
      `
    )
    .join("");
}

function renderAnalytics(analytics) {
  recentOrdersCache = analytics.recentOrders || [];
  const highestRevenuePoint = Math.max(...analytics.revenueSeries.map((point) => point.revenue), 1);

  analyticsWrap.innerHTML = `
    <div class="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article class="dashboard-tile p-4">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Today</p>
        <p class="mt-3 text-xl font-semibold text-ink sm:text-2xl">${formatInr(analytics.revenue.daily)}</p>
        <p class="mt-2 text-sm text-slate">${analytics.orders.today} orders</p>
      </article>
      <article class="dashboard-tile p-4">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">This week</p>
        <p class="mt-3 text-xl font-semibold text-ink sm:text-2xl">${formatInr(analytics.revenue.weekly)}</p>
        <p class="mt-2 text-sm text-slate">${analytics.orders.weekly} orders</p>
      </article>
      <article class="dashboard-tile p-4">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">This month</p>
        <p class="mt-3 text-xl font-semibold text-ink sm:text-2xl">${formatInr(analytics.revenue.monthly)}</p>
        <p class="mt-2 text-sm text-slate">${analytics.orders.monthly} orders</p>
      </article>
      <article class="dashboard-tile p-4">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Total revenue</p>
        <p class="mt-3 text-xl font-semibold text-ink sm:text-2xl">${formatInr(analytics.revenue.total)}</p>
        <p class="mt-2 text-sm text-slate">${analytics.orders.total} orders overall</p>
      </article>
    </div>
    <div class="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <article class="dashboard-tile">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="eyebrow">Last 7 days</p>
            <h3 class="mt-2 text-xl sm:text-2xl">Revenue trend</h3>
          </div>
          <span class="ghost-tag">${formatInr(analytics.averageOrderValue)} avg order</span>
        </div>
        <div class="mt-4 flex h-36 items-end gap-2 sm:mt-6 sm:h-48 sm:gap-3">
          ${analytics.revenueSeries
            .map(
              (point) => `
                <div class="flex flex-1 flex-col items-center gap-2 sm:gap-3">
                  <div class="flex h-24 w-full items-end sm:h-36">
                    <div class="w-full rounded-t-[16px] bg-sky/85" style="height: ${Math.max((point.revenue / highestRevenuePoint) * 100, point.revenue ? 14 : 6)}%"></div>
                  </div>
                  <div class="text-center">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate/65">${point.label}</p>
                    <p class="mt-1 text-[11px] text-slate sm:text-xs">${point.revenue ? formatInr(point.revenue) : "Rs 0"}</p>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
      <article class="dashboard-tile">
        <p class="eyebrow">Business snapshot</p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
          <div class="rounded-[22px] border border-[#e0d7ca] bg-[#fffaf4] px-4 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Customers</p>
            <p class="mt-2 text-2xl font-semibold text-ink">${analytics.customers.total}</p>
          </div>
          <div class="rounded-[22px] border border-[#e0d7ca] bg-[#fffaf4] px-4 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Active products</p>
            <p class="mt-2 text-2xl font-semibold text-ink">${analytics.inventory.activeProducts}</p>
          </div>
          <div class="rounded-[22px] border border-[#e0d7ca] bg-[#fffaf4] px-4 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Today's orders</p>
            <p class="mt-2 text-2xl font-semibold text-ink">${analytics.orders.today}</p>
          </div>
          <div class="rounded-[22px] border border-[#e0d7ca] bg-[#fffaf4] px-4 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">Catalog size</p>
            <p class="mt-2 text-2xl font-semibold text-ink">${analytics.inventory.totalProducts}</p>
          </div>
        </div>
      </article>
    </div>
  `;

  if (!analytics.recentOrders.length) {
    recentOrdersWrap.innerHTML = `
      <article class="dashboard-tile">
        <p class="text-lg font-semibold text-ink">No orders yet</p>
        <p class="mt-2 text-sm leading-7 text-slate">Revenue cards will fill up as customers start placing orders.</p>
      </article>
    `;
  } else {
    recentOrdersWrap.innerHTML = analytics.recentOrders
      .map(
        (order) => `
          <button class="dashboard-tile w-full text-left" type="button" data-order-id="${order.id}">
            <div class="flex items-start gap-3 sm:gap-4">
              <img class="h-14 w-14 rounded-[16px] object-cover sm:h-16 sm:w-16 sm:rounded-[18px]" src="${order.previewImage}" alt="${order.previewName || order.userName}" />
              <div class="min-w-0 flex-1">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div class="min-w-0">
                    <p class="text-base font-semibold text-ink">${order.userName || "Customer"}</p>
                    <p class="mt-1 text-sm text-slate">${formatCompactDate(order.createdAt)} • ${order.itemCount} items</p>
                  </div>
                  <div class="self-start">${getStatusBadge(order.status)}</div>
                </div>
                <div class="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm text-slate">${order.previewName || `Order #${String(order.id).slice(-6)}`}</p>
                    <p class="mt-1 text-sm text-slate">Order #${String(order.id).slice(-6)}</p>
                  </div>
                  <p class="text-base font-semibold text-ink sm:text-right">${formatInr(order.totalAmount)}</p>
                </div>
              </div>
            </div>
          </button>
        `
      )
      .join("");

    recentOrdersWrap.querySelectorAll("[data-order-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const order = recentOrdersCache.find((entry) => entry.id === button.getAttribute("data-order-id"));
        if (order) {
          openOrderModal(order);
        }
      });
    });
  }

  if (!analytics.topProducts.length) {
    topProductsWrap.innerHTML = `
      <article class="dashboard-tile">
        <p class="text-lg font-semibold text-ink">No product sales yet</p>
        <p class="mt-2 text-sm leading-7 text-slate">Top performers will appear once orders are placed.</p>
      </article>
    `;
  } else {
    topProductsWrap.innerHTML = analytics.topProducts
      .map(
        (product) => `
          <article class="dashboard-tile">
            <div class="flex items-start gap-3 sm:items-center sm:gap-4">
              <img class="h-14 w-14 rounded-[16px] object-cover sm:h-16 sm:w-16 sm:rounded-[18px]" src="${product.image}" alt="${product.name}" />
              <div class="min-w-0 flex-1">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div class="min-w-0">
                    <p class="line-clamp-2 text-base font-semibold text-ink">${product.name}</p>
                    <p class="mt-1 text-sm text-slate">${product.quantity} sold</p>
                  </div>
                  <span class="price-tag self-start">${formatInr(product.revenue)}</span>
                </div>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  }
}

function getCategoryCounts(products, categories) {
  return categories
    .map((category) => ({
      category,
      total: products.filter((product) => product.category === category).length
    }))
    .sort((a, b) => b.total - a.total);
}

function renderAlerts(products) {
  const lowStockProducts = [...products]
    .filter((product) => product.stock <= 12)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  if (!lowStockProducts.length) {
    alertsWrap.innerHTML = `
      <article class="dashboard-tile">
        <p class="text-lg font-semibold text-ink">All products look healthy</p>
        <p class="mt-2 text-sm leading-7 text-slate">No urgent low-stock alerts right now.</p>
      </article>
    `;
    return;
  }

  alertsWrap.innerHTML = lowStockProducts
    .map(
      (product) => `
        <article class="dashboard-tile">
          <div class="flex items-start gap-3 sm:items-center sm:gap-4">
            <img class="h-14 w-14 rounded-[16px] object-cover sm:h-16 sm:w-16 sm:rounded-[18px]" src="${product.image}" alt="${product.name}" />
            <div class="min-w-0 flex-1">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div class="min-w-0">
                  <p class="truncate text-base font-semibold text-ink">${product.name}</p>
                  <p class="mt-1 text-sm text-slate">${product.category}</p>
                </div>
                <span class="ghost-tag self-start ${product.stock === 0 ? "!bg-[#fee4e2] !text-[#b42318]" : ""}">${product.stock} left</span>
              </div>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderPerformance(products, categories) {
  const counts = getCategoryCounts(products, categories);
  const highestCount = counts[0]?.total || 1;

  performanceWrap.innerHTML = counts
    .slice(0, 5)
    .map(
      ({ category, total }) => `
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-ink">${category}</p>
            <p class="text-sm text-slate">${total}</p>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-[#ece4d8]">
            <div class="h-full rounded-full bg-sky" style="width: ${(total / highestCount) * 100}%"></div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderProducts(products) {
  inventoryStatus.textContent = `${products.length} live items`;

  productsWrap.innerHTML = products
    .slice(0, 10)
    .map(
      (product) => `
        <article class="dashboard-tile">
          <div class="flex flex-col gap-4 sm:flex-row">
            <img class="h-40 w-full rounded-[22px] object-cover sm:h-24 sm:w-24" src="${product.image}" alt="${product.name}" />
            <div class="min-w-0 flex-1">
              <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <h3 class="text-lg font-semibold text-ink">${product.name}</h3>
                  <p class="mt-1 text-sm text-slate">${product.category}</p>
                </div>
                <span class="price-tag self-start">Rs ${product.price}</span>
              </div>
              <p class="line-clamp-3 mt-3 text-sm leading-7 text-slate">${product.description}</p>
              <div class="mt-4 flex flex-wrap gap-2">
                <span class="ghost-tag">${product.stock} in stock</span>
                <button class="chip-link w-full justify-center sm:w-auto" type="button" data-edit-product="${product.id}">Edit</button>
                <button class="chip-link !text-[#b42318] w-full justify-center sm:w-auto" type="button" data-delete-product="${product.id}">Remove</button>
              </div>
            </div>
          </div>
        </article>
      `
    )
    .join("");

  productsWrap.querySelectorAll("[data-edit-product]").forEach((button) => {
    button.addEventListener("click", () => {
      const product = productCache.find((item) => item.id === button.dataset.editProduct);
      if (product) {
        fillForm(product);
      }
    });
  });

  productsWrap.querySelectorAll("[data-delete-product]").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = button.dataset.deleteProduct;
      const product = productCache.find((item) => item.id === productId);
      const confirmed = window.confirm(`Remove ${product?.name || "this product"}?`);

      if (!confirmed) {
        return;
      }

      try {
        await request(`/products/${productId}`, {
          method: "DELETE",
          auth: true
        });
        showMessage(pageMessage, "Product removed.", "success");
        await loadAdminDashboard();
      } catch (error) {
        showMessage(pageMessage, error.message);
      }
    });
  });
}

function renderCategories(products, categories) {
  const counts = getCategoryCounts(products, categories);

  categoriesWrap.innerHTML = counts
    .map(
      ({ category, total }) => `
        <div class="dashboard-tile">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-lg font-semibold text-ink">${category}</p>
              <p class="mt-2 text-sm text-slate">${total} product${total === 1 ? "" : "s"}</p>
            </div>
            <a class="chip-link" href="/home.html?category=${encodeURIComponent(category)}">View</a>
          </div>
        </div>
      `
    )
    .join("");
}

async function loadAdminDashboard() {
  clearMessage(pageMessage);

  try {
    const [{ products }, { categories }, { analytics }] = await Promise.all([
      request("/products"),
      request("/products/categories"),
      request("/orders/admin/analytics", { auth: true })
    ]);
    productCache = products;
    renderMetrics(products, categories);
    renderAnalytics(analytics);
    renderAlerts(products);
    renderPerformance(products, categories);
    renderProducts(products);
    renderCategories(products, categories);
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}

if (!currentUser || currentUser.role !== "admin") {
  showAdminGate();
} else {
  showDashboard();
  resetForm();
  await loadAdminDashboard();
  subscribeToRealtimeAdminUpdates();
}

cancelEditButton?.addEventListener("click", () => {
  resetForm();
  clearMessage(pageMessage);
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(pageMessage);

  const formData = new FormData(form);
  const body = {
    name: formData.get("name")?.toString().trim(),
    price: Number(formData.get("price")),
    image: formData.get("image")?.toString().trim(),
    category: formData.get("category")?.toString().trim(),
    stock: Number(formData.get("stock")),
    description: formData.get("description")?.toString().trim()
  };

  const editingId = form.dataset.editingId;
  const method = editingId ? "PATCH" : "POST";
  const path = editingId ? `/products/${editingId}` : "/products";

  try {
    await request(path, {
      method,
      auth: true,
      body
    });

    showMessage(pageMessage, editingId ? "Product updated." : "Product added.", "success");
    resetForm();
    await loadAdminDashboard();
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
});

orderModalClose?.addEventListener("click", closeOrderModal);

orderModal?.addEventListener("click", (event) => {
  if (event.target === orderModal) {
    closeOrderModal();
  }
});

function subscribeToRealtimeAdminUpdates() {
  const refreshAdmin = async () => {
    clearTimeout(adminRefreshTimeout);
    adminRefreshTimeout = window.setTimeout(async () => {
      await loadAdminDashboard();
    }, 250);
  };

  subscribeToOrderSync(refreshAdmin);

  window.addEventListener("focus", refreshAdmin);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshAdmin();
    }
  });

  if (!adminPollingInterval) {
    adminPollingInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshAdmin();
      }
    }, 8000);
  }
}
