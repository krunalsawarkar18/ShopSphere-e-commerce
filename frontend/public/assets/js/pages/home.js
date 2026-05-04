import { request } from "../modules/api.js";
import { requireAuth } from "../modules/auth.js";
import { bootstrapShell } from "../modules/bootstrap.js";
import { getFavoriteIds, syncFavoriteButtons } from "../modules/favorites.js";
import { clearMessage, formatCurrency, showMessage } from "../modules/helpers.js";
import { refreshCartBadge } from "../modules/layout.js";

bootstrapShell("/home.html");

const PAGE_SIZE = 8;

const productGrid = document.querySelector("#product-grid");
const productCount = document.querySelector("#product-count");
const productFeedStatus = document.querySelector("#product-feed-status");
const productLoadTrigger = document.querySelector("#product-load-trigger");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const pageMessage = document.querySelector("#page-message");
const params = new URLSearchParams(window.location.search);

const state = {
  products: [],
  total: 0,
  offset: 0,
  hasMore: false,
  isLoading: false,
  favoritesOnly: params.get("favorites") === "1",
  search: params.get("search") || "",
  category: params.get("category") || "",
  observer: null
};

searchInput.value = state.search;

function buildProductQuery({ offset = 0, limit } = {}) {
  const query = new URLSearchParams();

  if (state.search) {
    query.set("search", state.search);
  }

  if (state.category) {
    query.set("category", state.category);
  }

  if (Number.isFinite(limit) && limit > 0) {
    query.set("limit", String(limit));
    query.set("offset", String(offset));
  }

  return query.toString();
}

async function loadCategories(selectedCategory) {
  const { categories } = await request("/products/categories");

  categoryFilter.innerHTML = `
    <option value="">All categories</option>
    ${categories
      .map(
        (category) =>
          `<option value="${category}" ${selectedCategory === category ? "selected" : ""}>${category}</option>`
      )
      .join("")}
  `;
}

function getProductCountLabel() {
  if (!state.total) {
    return "0 products";
  }

  if (state.products.length >= state.total) {
    return `${state.total} product${state.total === 1 ? "" : "s"}`;
  }

  return `${state.products.length} of ${state.total} products`;
}

function renderProductSkeletons(count = PAGE_SIZE) {
  productCount.textContent = "Loading products...";
  productGrid.innerHTML = Array.from({ length: count }, () => `
      <article class="product-card product-card-skeleton p-4" aria-hidden="true">
        <div class="product-image-wrap h-52 w-full sm:h-64"></div>
        <div class="pt-4">
          <div class="h-6 rounded-full" style="width: 82%; background: #ece4d8;"></div>
          <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="h-10 rounded-full" style="width: 7rem; background: #ece4d8;"></div>
            <div class="h-10 w-full rounded-full sm:w-20" style="background: #ece4d8;"></div>
          </div>
          <div class="mt-3 h-4 w-full rounded-full" style="background: #efe7dc;"></div>
          <div class="mt-2 h-4 rounded-full" style="width: 84%; background: #efe7dc;"></div>
          <div class="mt-4 grid gap-2 sm:grid-cols-2">
            <div class="h-10 rounded-full" style="background: #ece4d8;"></div>
            <div class="h-10 rounded-full" style="background: #ece4d8;"></div>
          </div>
        </div>
      </article>
    `).join("");
}

function renderProducts(products, favoritesOnly = false) {
  productCount.textContent = getProductCountLabel();

  if (!products.length) {
    productGrid.innerHTML = `
      <article class="promo-card col-span-full p-8 text-center">
        <h3 class="text-2xl">${favoritesOnly ? "No favourites yet" : "No products found"}</h3>
        <a class="btn-primary mt-6 w-full sm:w-auto" href="/home.html">${favoritesOnly ? "Browse products" : "Clear filters"}</a>
      </article>
    `;
    return;
  }

  productGrid.innerHTML = products
    .map(
      (product) => `
        <article class="product-card p-4">
          <a class="product-image-wrap block" href="/product.html?id=${product.id}">
            <img
              class="h-52 w-full object-cover sm:h-64"
              src="${product.image}"
              alt="${product.name}"
              loading="lazy"
              decoding="async"
            />
            <div class="absolute inset-x-0 top-0 flex items-center justify-end p-4">
              <button class="flex h-11 w-11 items-center justify-center rounded-full border border-transparent bg-[#fffaf4]/92 text-slate shadow-soft transition hover:text-rose-500" type="button" aria-label="Add to favourites" data-favorite-button data-product-id="${product.id}">
                <svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20.5 4.8 13.8a4.7 4.7 0 0 1 6.64-6.64L12 7.72l.56-.56a4.7 4.7 0 1 1 6.64 6.64L12 20.5Z" />
                </svg>
              </button>
            </div>
          </a>
          <div class="pt-4">
            <h3 class="line-clamp-2 text-lg sm:text-xl">${product.name}</h3>
            <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <a class="price-tag justify-center sm:justify-start" href="/product.html?id=${product.id}">${formatCurrency(product.price)}</a>
              <a class="chip-link w-full justify-center sm:w-auto" href="/product.html?id=${product.id}">View</a>
            </div>
            <p class="line-clamp-3 mt-3 text-sm leading-6 text-slate">${product.description}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <a class="ghost-tag w-full justify-center hover:bg-sky hover:text-white sm:w-auto" href="/checkout.html">Fast checkout</a>
              <button class="ghost-tag w-full justify-center hover:bg-ink hover:text-white sm:w-auto" type="button" data-add-cart-id="${product.id}">Easy cart</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");

  syncFavoriteButtons(productGrid);
}

function updateLoadStatus() {
  if (!productFeedStatus || !productLoadTrigger) {
    return;
  }

  if (!state.products.length && state.isLoading) {
    productFeedStatus.textContent = "Loading products...";
    productLoadTrigger.classList.add("hidden");
    return;
  }

  if (state.favoritesOnly || !state.products.length) {
    productFeedStatus.textContent = "";
    productLoadTrigger.classList.add("hidden");
    return;
  }

  productLoadTrigger.classList.toggle("hidden", !state.hasMore);

  if (state.isLoading) {
    productFeedStatus.textContent = "Loading more products...";
    return;
  }

  if (state.hasMore) {
    productFeedStatus.textContent = "Scroll to load more products.";
    return;
  }

  productFeedStatus.textContent = "All products loaded.";
}

function syncPagination(pagination, batchSize) {
  if (state.favoritesOnly) {
    state.offset = state.products.length;
    state.hasMore = false;
    state.total = state.products.length;
    return;
  }

  state.offset += batchSize;
  state.total = Number(pagination?.total ?? state.products.length);
  state.hasMore = Boolean(pagination?.hasMore);
}

async function loadInitialProducts() {
  clearMessage(pageMessage);
  state.products = [];
  state.total = 0;
  state.offset = 0;
  state.hasMore = false;
  state.isLoading = true;
  renderProductSkeletons();
  updateLoadStatus();

  try {
    const initialQuery = buildProductQuery({
      offset: 0,
      limit: state.favoritesOnly ? undefined : PAGE_SIZE
    });

    const [{ products, pagination }] = await Promise.all([
      request(`/products${initialQuery ? `?${initialQuery}` : ""}`),
      loadCategories(state.category)
    ]);

    state.products = state.favoritesOnly
      ? products.filter((product) => getFavoriteIds().includes(String(product.id)))
      : products;

    syncPagination(pagination, products.length);
    renderProducts(state.products, state.favoritesOnly);
    setupInfiniteLoading();
  } catch (error) {
    state.products = [];
    state.total = 0;
    state.hasMore = false;
    productCount.textContent = "0 products";
    productGrid.innerHTML = "";
    showMessage(pageMessage, error.message);
  } finally {
    state.isLoading = false;
    updateLoadStatus();
  }
}

async function loadNextProducts() {
  if (state.isLoading || state.favoritesOnly || !state.hasMore) {
    return;
  }

  state.isLoading = true;
  updateLoadStatus();

  try {
    const query = buildProductQuery({ offset: state.offset, limit: PAGE_SIZE });
    const { products, pagination } = await request(`/products?${query}`);

    state.products = [...state.products, ...products];
    syncPagination(pagination, products.length);
    renderProducts(state.products, state.favoritesOnly);
  } catch (error) {
    showMessage(pageMessage, error.message);
  } finally {
    state.isLoading = false;
    updateLoadStatus();
  }
}

function setupInfiniteLoading() {
  state.observer?.disconnect();

  if (state.favoritesOnly || !productLoadTrigger || !state.hasMore) {
    return;
  }

  state.observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadNextProducts();
      }
    },
    { rootMargin: "240px 0px" }
  );

  state.observer.observe(productLoadTrigger);
}

productGrid?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-add-cart-id]");

  if (!button) {
    return;
  }

  clearMessage(pageMessage);

  const user = await requireAuth();

  if (!user) {
    return;
  }

  const productId = button.getAttribute("data-add-cart-id");

  try {
    await request("/cart/items", {
      method: "POST",
      auth: true,
      body: { productId, quantity: 1 }
    });

    showMessage(pageMessage, "Item added to cart.", "success");
    await refreshCartBadge();
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
});

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextParams = new URLSearchParams(window.location.search);
  const search = searchInput.value.trim();

  if (search) {
    nextParams.set("search", search);
  } else {
    nextParams.delete("search");
  }

  window.location.search = nextParams.toString();
});

categoryFilter?.addEventListener("change", () => {
  const nextParams = new URLSearchParams(window.location.search);
  const category = categoryFilter.value;

  if (category) {
    nextParams.set("category", category);
  } else {
    nextParams.delete("category");
  }

  window.location.search = nextParams.toString();
});

window.addEventListener("favorites:changed", () => {
  if (state.favoritesOnly) {
    loadInitialProducts();
    return;
  }

  syncFavoriteButtons(productGrid);
});

await loadInitialProducts();
