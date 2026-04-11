import { request } from "../modules/api.js";
import { formatCurrency, showMessage } from "../modules/helpers.js";
import { mountShell, refreshCartBadge } from "../modules/layout.js";
import { syncCurrentUser } from "../modules/auth.js";
import { syncFavoriteButtons } from "../modules/favorites.js";

mountShell("/index.html");
await syncCurrentUser();
await refreshCartBadge();

let bannerSlides = [
  {
    eyebrow: "Beauty picks",
    title: "Glow essentials, daily staples",
    subtitle: "Shop trending makeup and self-care picks with easy checkout.",
    accent: "Shop beauty",
    accentHref: "/home.html?category=Beauty",
    bgStyle:
      "background-image: radial-gradient(circle at top left, rgba(255,250,244,0.65), transparent 28%), linear-gradient(135deg, #f7efe5 0%, #f2e6d9 48%, #ebddcf 100%);",
    chipStyle: "background: rgba(255,250,244,0.8); color: #a14e24;",
    titleStyle: "color: #18181b;",
    copyStyle: "color: rgba(39, 39, 42, 0.78);",
    priceStyle: "color: #a14e24;",
    accentStyle: "background: #14532d; color: white;",
    secondaryButtonStyle:
      "border: 1px solid rgba(16,24,38,0.08); background: rgba(255,250,244,0.72); color: #101826;",
    arrowStyle:
      "border: 1px solid rgba(16,24,38,0.08); background: rgba(255,250,244,0.92); color: #101826; box-shadow: 0 10px 24px rgba(86,94,106,0.16);",
    dotActiveStyle: "background: #14532d;",
    dotStyle: "background: rgba(20,83,45,0.18);",
    products: [
      {
        name: "Essence Mascara Lash Princess",
        image: "/assets/images/products/essence-mascara.webp",
        price: 899
      },
      {
        name: "Red Lipstick",
        image: "/assets/images/products/red-lipstick.webp",
        price: 699
      },
      {
        name: "Attitude Super Leaves Hand Soap",
        image: "/assets/images/products/hand-soap.webp",
        price: 499
      }
    ]
  },
  {
    eyebrow: "Tech zone",
    title: "Devices that still turn heads",
    subtitle: "Phones, laptops, and audio that bring a sharper storefront feel.",
    accent: "Shop tech",
    accentHref: "/home.html?category=Smartphones",
    bgStyle:
      "background-image: radial-gradient(circle at top left, rgba(20,83,45,0.16), transparent 25%), linear-gradient(135deg, #ecf0e9 0%, #dde5db 52%, #d4ddd5 100%);",
    chipStyle: "background: rgba(255,250,244,0.78); color: #14532d;",
    titleStyle: "color: #0f172a;",
    copyStyle: "color: rgba(15, 23, 42, 0.7);",
    priceStyle: "color: #14532d;",
    accentStyle: "background: #101826; color: white;",
    secondaryButtonStyle:
      "border: 1px solid rgba(16,24,38,0.08); background: rgba(255,250,244,0.72); color: #101826;",
    arrowStyle:
      "border: 1px solid rgba(16,24,38,0.08); background: rgba(255,250,244,0.92); color: #101826; box-shadow: 0 10px 24px rgba(86,94,106,0.16);",
    dotActiveStyle: "background: #101826;",
    dotStyle: "background: rgba(16,24,38,0.16);",
    products: [
      {
        name: "Apple MacBook Pro 14 Inch Space Grey",
        image: "/assets/images/products/macbook-pro.webp",
        price: 169999
      },
      {
        name: "iPhone 5s",
        image: "/assets/images/products/iphone-5s.webp",
        price: 18999
      },
      {
        name: "Calvin Klein CK One",
        image: "/assets/images/products/ck-one.webp",
        price: 3499
      }
    ]
  },
  {
    eyebrow: "Home and style",
    title: "Fresh arrivals for every corner",
    subtitle: "Furniture, decor, bags, and standout staples all in one scroll.",
    accent: "Explore more",
    accentHref: "/home.html",
    bgStyle:
      "background-image: radial-gradient(circle at top left, rgba(196,106,60,0.16), transparent 24%), linear-gradient(135deg, #f4eee6 0%, #ebdfd2 55%, #e3d6c8 100%);",
    chipStyle: "background: rgba(255,250,244,0.78); color: #8d4f2d;",
    titleStyle: "color: #111827;",
    copyStyle: "color: rgba(17, 24, 39, 0.72);",
    priceStyle: "color: #8d4f2d;",
    accentStyle: "background: #14532d; color: white;",
    secondaryButtonStyle:
      "border: 1px solid rgba(16,24,38,0.08); background: rgba(255,250,244,0.72); color: #101826;",
    arrowStyle:
      "border: 1px solid rgba(16,24,38,0.08); background: rgba(255,250,244,0.92); color: #101826; box-shadow: 0 10px 24px rgba(86,94,106,0.16);",
    dotActiveStyle: "background: #14532d;",
    dotStyle: "background: rgba(20,83,45,0.18);",
    products: [
      {
        name: "Annibale Colombo Sofa",
        image: "/assets/images/products/annibale-sofa.webp",
        price: 124999
      },
      {
        name: "Blue Women's Handbag",
        image: "/assets/images/products/blue-handbag.webp",
        price: 2599
      },
      {
        name: "Decoration Swing",
        image: "/assets/images/products/decoration-swing.webp",
        price: 4599
      }
    ]
  }
];

let currentBannerIndex = 0;
let bannerInterval;

const promoBanner = document.querySelector("#promo-banner");
const categoriesWrap = document.querySelector("#front-categories");
const desktopCategoriesWrap = document.querySelector("#front-categories-desktop");
const featuredWrap = document.querySelector("#front-featured");
const freshWrap = document.querySelector("#front-fresh");
const message = document.querySelector("#front-message");

function normalizeProductName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hydrateBannerSlides(products) {
  const productMap = new Map(
    products.map((product) => [normalizeProductName(product.name), product])
  );

  return bannerSlides.map((slide) => ({
    ...slide,
    products: slide.products.map((product) => {
      const matchedProduct = productMap.get(normalizeProductName(product.name));

      if (!matchedProduct) {
        return product;
      }

      return {
        ...product,
        id: matchedProduct.id,
        image: matchedProduct.image,
        price: matchedProduct.price
      };
    })
  }));
}

function renderBanner() {
  const slide = bannerSlides[currentBannerIndex];

  promoBanner.innerHTML = `
    <div class="relative overflow-hidden rounded-[28px] border border-[#e6d9d1] sm:rounded-[34px]" style="${slide.bgStyle}">
      <div class="relative grid min-h-[318px] gap-3 px-3.5 py-3.5 sm:min-h-[360px] sm:gap-6 sm:px-10 sm:py-9 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8 lg:px-12">
        <div class="flex flex-col justify-center">
          <span class="pill w-fit border border-[#d7deea]" style="${slide.chipStyle}">${slide.eyebrow}</span>
          <h1 class="mt-3 max-w-[270px] text-[1.72rem] leading-[0.96] sm:mt-6 sm:max-w-[520px] sm:text-[3.4rem] lg:text-[4.25rem]" style="${slide.titleStyle}">${slide.title}</h1>
          <p class="mt-2 max-w-[265px] text-[11px] leading-4.5 sm:mt-5 sm:max-w-xl sm:text-[1.04rem] sm:leading-7" style="${slide.copyStyle}">${slide.subtitle}</p>
          <div class="mt-3.5 grid grid-cols-2 gap-2 sm:mt-9 sm:flex sm:flex-row sm:flex-wrap">
            <a class="inline-flex items-center justify-center rounded-full px-3 py-2.5 text-[12px] font-semibold shadow-[0_14px_32px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 sm:w-auto sm:px-6 sm:py-3.5 sm:text-base" style="${slide.accentStyle}" href="${slide.accentHref}">${slide.accent}</a>
            <a class="inline-flex items-center justify-center rounded-full px-3 py-2.5 text-[12px] font-semibold transition hover:-translate-y-0.5 sm:w-auto sm:px-6 sm:py-3.5 sm:text-base" style="${slide.secondaryButtonStyle}" href="/home.html">See all</a>
          </div>
          <div class="mt-3.5 md:hidden">
            <div class="grid grid-cols-3 gap-1.5">
              ${slide.products
                .map(
                  (product) => `
                    <a class="rounded-[18px] border border-white/70 bg-white/82 p-1.5 shadow-[0_12px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm transition hover:-translate-y-1" href="${product.id ? `/product.html?id=${product.id}` : "#"}">
                      <div class="product-image-wrap flex h-[76px] items-center justify-center rounded-[12px] bg-white/96">
                        <img class="max-h-[64px] w-auto object-contain" src="${product.image}" alt="${product.name}" />
                      </div>
                      <div class="pt-1.5">
                        <p class="line-clamp-2 text-[10px] font-medium leading-3.5 text-ink">${product.name}</p>
                        <p class="mt-0.5 text-[11px] font-semibold" style="${slide.priceStyle}">${formatCurrency(product.price)}</p>
                      </div>
                    </a>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
        <div class="relative hidden min-h-[292px] overflow-hidden rounded-[32px] md:block">
          <div class="absolute inset-0 rounded-[32px] bg-white/8"></div>
          <div class="absolute -right-10 top-0 h-48 w-48 rounded-full bg-white/16 blur-3xl"></div>
          <div class="absolute bottom-4 left-8 right-8 h-20 rounded-full bg-[#deb7aa]/18 blur-3xl"></div>
          <div class="absolute inset-x-4 inset-y-0 flex items-center justify-center gap-5 lg:gap-6">
            ${slide.products
              .map(
                (product) => `
                  <a class="flex w-full max-w-[208px] flex-col rounded-[30px] border border-white/70 bg-white/82 p-4 shadow-[0_18px_38px_rgba(15,23,42,0.08)] backdrop-blur-sm transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(15,23,42,0.12)]" href="${product.id ? `/product.html?id=${product.id}` : "#"}">
                    <div class="product-image-wrap flex h-[190px] items-center justify-center rounded-[24px] bg-white/96">
                      <img class="max-h-[168px] w-auto object-contain" src="${product.image}" alt="${product.name}" />
                    </div>
                    <div class="flex flex-1 flex-col justify-end pt-4">
                      <p class="min-h-[76px] text-[15px] font-medium leading-7 text-ink sm:text-[1.03rem]">${product.name}</p>
                      <p class="mt-2 text-[1.08rem] font-semibold" style="${slide.priceStyle}">${formatCurrency(product.price)}</p>
                    </div>
                  </a>
                `
              )
              .join("")}
          </div>
        </div>
      </div>
      <button class="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-xl font-bold backdrop-blur transition hover:-translate-y-[52%] sm:flex sm:h-11 sm:w-11" style="${slide.arrowStyle}" type="button" data-banner-dir="prev" aria-label="Previous banner">&lt;</button>
      <button class="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-xl font-bold backdrop-blur transition hover:-translate-y-[52%] sm:flex sm:h-11 sm:w-11" style="${slide.arrowStyle}" type="button" data-banner-dir="next" aria-label="Next banner">&gt;</button>
      <div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 sm:bottom-5">
        ${bannerSlides
          .map(
            (_, index) => `
              <button
                class="${index === currentBannerIndex ? "w-8" : "w-2.5"} h-2.5 rounded-full transition"
                style="${index === currentBannerIndex ? slide.dotActiveStyle : slide.dotStyle}"
                type="button"
                data-banner-index="${index}"
                aria-label="Go to banner ${index + 1}"
              ></button>
            `
          )
          .join("")}
      </div>
    </div>
  `;

  promoBanner.querySelectorAll("[data-banner-dir]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.getAttribute("data-banner-dir");
      currentBannerIndex =
        direction === "next"
          ? (currentBannerIndex + 1) % bannerSlides.length
          : (currentBannerIndex - 1 + bannerSlides.length) % bannerSlides.length;
      renderBanner();
      startBannerAutoPlay();
    });
  });

  promoBanner.querySelectorAll("[data-banner-index]").forEach((button) => {
    button.addEventListener("click", () => {
      currentBannerIndex = Number(button.getAttribute("data-banner-index"));
      renderBanner();
      startBannerAutoPlay();
    });
  });
}

function startBannerAutoPlay() {
  window.clearInterval(bannerInterval);
  bannerInterval = window.setInterval(() => {
    currentBannerIndex = (currentBannerIndex + 1) % bannerSlides.length;
    renderBanner();
  }, 4500);
}

function renderCategories(categories) {
  const markup = categories
    .map(
      (category) =>
        `<a class="chip-link shrink-0" href="/home.html?category=${encodeURIComponent(category)}">${category}</a>`
    )
    .join("");

  if (categoriesWrap) {
    categoriesWrap.innerHTML = markup;
  }

  if (desktopCategoriesWrap) {
    desktopCategoriesWrap.innerHTML = markup;
  }
}

function renderProductCard(product) {
  return `
    <article class="product-card p-3 sm:p-4">
      <a class="product-image-wrap block" href="/product.html?id=${product.id}">
        <img class="h-36 w-full object-cover sm:h-56" src="${product.image}" alt="${product.name}" />
        <button class="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-[#fffaf4]/92 text-slate shadow-soft transition hover:text-rose-500 sm:right-4 sm:top-4 sm:h-11 sm:w-11" type="button" aria-label="Add to favourites" data-favorite-button data-product-id="${product.id}">
          <svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20.5 4.8 13.8a4.7 4.7 0 0 1 6.64-6.64L12 7.72l.56-.56a4.7 4.7 0 1 1 6.64 6.64L12 20.5Z" />
          </svg>
        </button>
      </a>
      <div class="pt-4">
        <h3 class="line-clamp-2 text-sm font-semibold leading-6 text-ink sm:text-lg">${product.name}</h3>
        <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <a class="price-tag justify-center sm:justify-start" href="/product.html?id=${product.id}">${formatCurrency(product.price)}</a>
          <a class="chip-link w-full justify-center sm:w-auto" href="/product.html?id=${product.id}">View</a>
        </div>
      </div>
    </article>
  `;
}

async function loadFrontPage() {
  try {
    const [{ categories }, { products }] = await Promise.all([request("/products/categories"), request("/products")]);

    bannerSlides = hydrateBannerSlides(products);
    renderBanner();
    startBannerAutoPlay();
    renderCategories(categories);

    const featuredProducts = products.slice(0, 4);
    const freshProducts = products.slice(4, 12).length ? products.slice(4, 12) : products.slice(0, 8);

    featuredWrap.innerHTML = featuredProducts.map(renderProductCard).join("");
    freshWrap.innerHTML = freshProducts.map(renderFreshCard).join("");
    syncFavoriteButtons(document);
  } catch (error) {
    showMessage(message, error.message);
  }
}

function renderFreshCard(product) {
  return `
    <a class="dashboard-tile block" href="/product.html?id=${product.id}">
      <div class="product-image-wrap">
        <img class="h-32 w-full object-cover sm:h-36" src="${product.image}" alt="${product.name}" />
      </div>
      <div class="mt-4 flex items-center justify-between gap-3">
        <p class="line-clamp-2 text-sm font-semibold text-ink">${product.name}</p>
        <span class="ghost-tag">${formatCurrency(product.price)}</span>
      </div>
    </a>
  `;
}

await loadFrontPage();
