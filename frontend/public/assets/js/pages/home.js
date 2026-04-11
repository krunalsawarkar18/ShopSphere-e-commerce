import { request } from "../modules/api.js";
import { clearMessage, formatCurrency, showMessage } from "../modules/helpers.js";
import { mountShell, refreshCartBadge } from "../modules/layout.js";
import { requireAuth, syncCurrentUser } from "../modules/auth.js";
import { getFavoriteIds, syncFavoriteButtons } from "../modules/favorites.js";

mountShell("/home.html");
await syncCurrentUser();
await refreshCartBadge();

const productGrid = document.querySelector("#product-grid");
const productCount = document.querySelector("#product-count");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const pageMessage = document.querySelector("#page-message");
const params = new URLSearchParams(window.location.search);

searchInput.value = params.get("search") || "";

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

function renderProducts(products, favoritesOnly = false) {
  productCount.textContent = `${products.length} product${products.length === 1 ? "" : "s"}`;

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
            <img class="h-52 w-full object-cover sm:h-64" src="${product.image}" alt="${product.name}" />
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

  syncFavoriteButtons(document);

  document.querySelectorAll("[data-add-cart-id]").forEach((button) => {
    if (button.dataset.cartBound === "true") {
      return;
    }

    button.dataset.cartBound = "true";
    button.addEventListener("click", async () => {
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
  });
}

async function loadProducts() {
  clearMessage(pageMessage);
  const search = params.get("search") || "";
  const category = params.get("category") || "";
  const favoritesOnly = params.get("favorites") === "1";

  try {
    await loadCategories(category);
    const query = new URLSearchParams();

    if (search) {
      query.set("search", search);
    }

    if (category) {
      query.set("category", category);
    }

    const queryString = query.toString();
    const { products } = await request(`/products${queryString ? `?${queryString}` : ""}`);
    const visibleProducts = favoritesOnly
      ? products.filter((product) => getFavoriteIds().includes(String(product.id)))
      : products;

    renderProducts(visibleProducts, favoritesOnly);
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}

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
  if (params.get("favorites") === "1") {
    loadProducts();
  }
});

await loadProducts();
