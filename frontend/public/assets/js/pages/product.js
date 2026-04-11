import { request } from "../modules/api.js";
import { requireAuth, syncCurrentUser } from "../modules/auth.js";
import { clearMessage, formatCurrency, getQueryParam, showMessage } from "../modules/helpers.js";
import { mountShell, refreshCartBadge } from "../modules/layout.js";

mountShell("");
const currentUser = await syncCurrentUser();
await refreshCartBadge();

const detail = document.querySelector("#product-detail");
const similarProducts = document.querySelector("#similar-products");
const pageMessage = document.querySelector("#page-message");
const mobileBuyBar = document.querySelector("#mobile-buy-bar");
const productId = getQueryParam("id");

function getProductMeta(product) {
  const seed = String(product.id)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  const rating = (4 + (seed % 9) / 10).toFixed(1);
  const reviews = 120 + (seed % 430);
  const bought = 80 + (seed % 240);
  const mrp = Math.round(product.price * 1.45);
  const discount = Math.max(12, Math.round(((mrp - product.price) / mrp) * 100));

  return { rating, reviews, bought, mrp, discount };
}

function getProductDetails(product) {
  const featureMap = {
    Beauty: [
      "Smooth daily-use formula designed for consistent results.",
      "Compact pack size that fits easily into handbags and travel kits.",
      "Made for quick everyday routines with minimal effort."
    ],
    Fragrances: [
      "Balanced scent profile that works well for day and evening wear.",
      "Premium bottle finish with gifting-friendly presentation.",
      "Longer-lasting feel compared with standard everyday sprays."
    ],
    Furniture: [
      "Statement piece designed to elevate modern rooms and corners.",
      "Built with a durable finish for regular home use.",
      "Works well across bedroom, lounge, and reading-space setups."
    ],
    Groceries: [
      "Everyday pantry essential suited for regular household use.",
      "Easy-to-store packaging with simple repeat-buy value.",
      "Good fit for quick meals, snacks, and daily kitchen routines."
    ],
    "Home Decoration": [
      "Decor-focused design that adds visual depth to shelves and tables.",
      "Pairs well with modern, minimal, and warm-tone interiors.",
      "Useful as a gifting option for housewarming and festive setups."
    ],
    Laptops: [
      "Strong everyday performance for work, browsing, and entertainment.",
      "Premium build quality with a clean modern finish.",
      "Suitable for users who want a dependable high-value device."
    ],
    "Mens Shoes": [
      "Comfort-led design made for casual daily wear.",
      "Fashion-forward silhouette with strong street-style appeal.",
      "Versatile enough to pair with jeans, joggers, or relaxed fits."
    ],
    "Skin Care": [
      "Gentle daily-use care product for everyday routines.",
      "Easy application with a clean, no-fuss format.",
      "Helpful for keeping self-care shelves simple and organized."
    ],
    Smartphones: [
      "Compact device size for easier one-hand use.",
      "Reliable choice for calling, browsing, and everyday tasks.",
      "Classic design language that still feels familiar and practical."
    ],
    "Womens Bags": [
      "Roomy design for daily carry without looking bulky.",
      "Practical compartments for essentials and quick access items.",
      "Style-forward finish that works for casual and semi-dressy use."
    ]
  };

  const features = featureMap[product.category] || [
    "Designed for easy everyday use.",
    "Clean finish with dependable value.",
    "Suitable for regular personal or home use."
  ];

  const specs = [
    { label: "Category", value: product.category },
    { label: "Stock", value: `${product.stock} available` },
    { label: "Delivery", value: "Fast dispatch" },
    { label: "Returns", value: "Easy return window" }
  ];

  return { features, specs };
}

function renderStars(rating) {
  const fullStars = Math.round(Number(rating));
  return Array.from({ length: 5 }, (_, index) =>
    index < fullStars
      ? '<span class="text-[#f59e0b]">★</span>'
      : '<span class="text-[#d1d5db]">★</span>'
  ).join("");
}

async function addCurrentProductToCart(productId, quantity = 1) {
  clearMessage(pageMessage);

  if (currentUser?.role === "admin") {
    showMessage(pageMessage, "Admins can manage the store, but they cannot order products.");
    return;
  }

  const user = await requireAuth();

  if (!user) {
    return;
  }

  try {
    await request("/cart/items", {
      method: "POST",
      auth: true,
      body: { productId, quantity }
    });

    showMessage(pageMessage, "Item added to cart.", "success");
    await refreshCartBadge();
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}

async function buyNow(productId, quantity = 1) {
  if (currentUser?.role === "admin") {
    showMessage(pageMessage, "Admins can manage the store, but they cannot order products.");
    return;
  }

  const user = await requireAuth();

  if (!user) {
    return;
  }

  try {
    await request("/cart/items", {
      method: "POST",
      auth: true,
      body: { productId, quantity }
    });

    await refreshCartBadge();
    window.location.href = "/checkout.html";
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}

function renderSimilarProducts(products) {
  if (!products.length) {
    similarProducts.innerHTML = `
      <article class="promo-card col-span-full p-8 text-center">
        <h3 class="text-2xl">No similar products found</h3>
      </article>
    `;
    return;
  }

  similarProducts.innerHTML = products
    .map(
      (product) => `
        <article class="product-card p-4">
          <a class="product-image-wrap block" href="/product.html?id=${product.id}">
            <img class="h-44 w-full object-cover sm:h-56" src="${product.image}" alt="${product.name}" />
          </a>
          <div class="pt-4">
            <h3 class="line-clamp-2 text-lg leading-7">${product.name}</h3>
            <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <a class="price-tag justify-center sm:justify-start" href="/product.html?id=${product.id}">${formatCurrency(product.price)}</a>
              <a class="chip-link w-full justify-center sm:w-auto" href="/product.html?id=${product.id}">View</a>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

if (!productId) {
  showMessage(pageMessage, "Missing product ID.");
} else {
  try {
    const { product } = await request(`/products/${productId}`);
    const meta = getProductMeta(product);
    const details = getProductDetails(product);
    const { products } = await request(`/products?category=${encodeURIComponent(product.category)}`);
    const related = products.filter((item) => item.id !== product.id).slice(0, 4);

    detail.innerHTML = `
      <div class="grid gap-8 lg:grid-cols-[1fr_1.02fr]">
        <div class="space-y-4">
          <div class="product-image-wrap rounded-[30px]">
            <img class="h-full min-h-[300px] w-full object-cover sm:min-h-[460px]" src="${product.image}" alt="${product.name}" />
            <div class="absolute left-5 top-5 flex flex-wrap gap-2">
              <p class="pill bg-[#fffaf4]/90">${product.category}</p>
              <span class="ghost-tag bg-[#fffaf4]/90">${product.stock} left</span>
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="mini-stat">
              <p class="text-sm font-semibold text-ink">Cash on delivery</p>
            </div>
            <div class="mini-stat">
              <p class="text-sm font-semibold text-ink">Easy returns</p>
            </div>
            <div class="mini-stat">
              <p class="text-sm font-semibold text-ink">Secure checkout</p>
            </div>
          </div>
        </div>

        <div class="p-0 sm:p-4">
          <p class="text-base font-semibold text-sky">${product.category} Store</p>
          <h1 class="mt-3 text-2xl leading-tight sm:text-4xl">${product.name}</h1>

          <div class="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <div class="flex items-center gap-1">${renderStars(meta.rating)}</div>
            <span class="font-semibold text-ink">${meta.rating}</span>
            <span class="text-slate">(${meta.reviews})</span>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-3">
            <span class="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">ShopSphere Select</span>
            <span class="text-sm font-semibold text-slate">${meta.bought}+ bought this month</span>
          </div>

          <div class="mt-7 border-t border-mist pt-6">
            <div class="flex flex-wrap items-end gap-3">
              <span class="text-xl font-semibold text-[#dc2626] sm:text-2xl">-${meta.discount}%</span>
              <span class="text-4xl font-heading text-ink sm:text-5xl">${formatCurrency(product.price)}</span>
            </div>
            <p class="mt-3 text-base text-slate">
              M.R.P. <span class="line-through">${formatCurrency(meta.mrp)}</span>
            </p>
            <p class="mt-2 text-base text-ink">Inclusive of all taxes</p>
          </div>

          <div class="mt-7 rounded-[26px] border border-[#ddd4c8] bg-[#f5efe6] p-5">
            <p class="text-sm font-semibold uppercase tracking-[0.16em] text-slate/70">About this item</p>
            <p class="mt-3 text-sm leading-7 text-slate">${product.description}</p>
            <div class="mt-5 space-y-3">
              ${details.features
                .map(
                  (feature) => `
                    <div class="flex items-start gap-3 text-sm text-slate">
                      <span class="mt-2 h-2 w-2 rounded-full bg-sky"></span>
                      <p class="leading-7">${feature}</p>
                    </div>
                  `
                )
                .join("")}
            </div>
            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              ${details.specs
                .map(
                  (spec) => `
                    <div class="rounded-[20px] border border-[#e0d7ca] bg-[#fffaf4] px-4 py-4">
                      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate/60">${spec.label}</p>
                      <p class="mt-2 text-sm font-semibold text-ink">${spec.value}</p>
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>

          <div class="mt-7 grid gap-4 sm:grid-cols-2">
            <div class="dashboard-tile">
              <p class="eyebrow">Availability</p>
              <p class="mt-3 text-lg font-semibold text-ink">${product.stock} units in stock</p>
            </div>
            <div class="dashboard-tile">
              <p class="eyebrow">Delivery</p>
              <p class="mt-3 text-lg font-semibold text-ink">Fast dispatch available</p>
            </div>
          </div>

          ${
            currentUser?.role === "admin"
              ? `
                <div class="mt-8 rounded-[24px] border border-[#ddd4c8] bg-[#f5efe6] p-5">
                  <p class="text-sm font-semibold text-slate">Admin accounts can manage products and customer orders, but they cannot order products.</p>
                </div>
              `
              : `
                <form id="add-to-cart-form" class="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <input class="field w-full max-w-full sm:max-w-[120px]" id="quantity" type="number" min="1" max="${product.stock}" value="1" />
                  <button class="btn-primary w-full sm:w-auto" type="submit">Add to cart</button>
                  <button class="chip-link w-full justify-center sm:w-auto" type="button" id="buy-now-button">Buy now</button>
                </form>
              `
          }
        </div>
      </div>
    `;

    if (mobileBuyBar && currentUser?.role !== "admin") {
      mobileBuyBar.innerHTML = `
        <div class="fixed inset-x-0 bottom-[76px] z-40 border-t border-[#ddd5c9] bg-[rgba(255,250,244,0.96)] px-4 py-3 backdrop-blur-xl shadow-[0_-18px_40px_rgba(16,24,38,0.12)]">
          <div class="mx-auto flex max-w-md items-center gap-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-ink">${product.name}</p>
              <p class="mt-1 text-base font-bold text-sky">${formatCurrency(product.price)}</p>
            </div>
            <button class="btn-secondary !px-4 !py-3" type="button" data-mobile-go-cart>Cart</button>
            <button class="btn-primary !px-4 !py-3" type="button" data-mobile-add>Buy now</button>
          </div>
        </div>
      `;
    }

    renderSimilarProducts(related);

    const addToCartForm = document.querySelector("#add-to-cart-form");

    addToCartForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const quantity = Number(document.querySelector("#quantity")?.value || 1);
      await addCurrentProductToCart(productId, quantity);
    });

    document.querySelector("#buy-now-button")?.addEventListener("click", async () => {
      const quantity = Number(document.querySelector("#quantity")?.value || 1);
      await buyNow(productId, quantity);
    });

    document.querySelector("[data-mobile-add]")?.addEventListener("click", async () => {
      await buyNow(productId, 1);
    });

    document.querySelector("[data-mobile-go-cart]")?.addEventListener("click", () => {
      window.location.href = "/cart.html";
    });
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}
