import { request } from "./api.js";
import { getCurrentUser } from "./auth.js";
import { clearSession, isAuthenticated } from "./storage.js";
import { getFavoriteCount } from "./favorites.js";

let shellListenersBound = false;
let softNavigationBound = false;
let isSoftNavigating = false;

function navLink(href, label, activePage) {
  const isActive = activePage === href;
  const classes = isActive
    ? "bg-sky text-white shadow-glow"
    : "text-slate transition hover:bg-[#efe8de] hover:text-ink";

  return `<a class="rounded-full px-4 py-2 text-sm font-semibold ${classes}" href="${href}">${label}</a>`;
}

function mobileNavLink(href, label, icon, activePage) {
  const isActive = activePage === href;
  const classes = isActive ? "text-sky" : "text-slate/75";

  return `
    <a class="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 ${classes}" href="${href}">
      ${icon}
      <span class="text-[11px] font-semibold leading-none">${label}</span>
    </a>
  `;
}

function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function shouldHandleLink(anchor) {
  if (!anchor) {
    return false;
  }

  const href = anchor.getAttribute("href");

  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:") ||
    anchor.hasAttribute("download") ||
    anchor.target === "_blank" ||
    anchor.dataset.noSoftNav !== undefined
  ) {
    return false;
  }

  const url = new URL(anchor.href, window.location.origin);

  return url.origin === window.location.origin && !url.pathname.startsWith("/api");
}

async function executeFetchedScripts(doc) {
  const scripts = [...doc.querySelectorAll("script")];

  for (const script of scripts) {
    const src = script.getAttribute("src");
    const type = script.getAttribute("type");

    if (src && type === "module") {
      const scriptUrl = new URL(src, window.location.origin);
      const separator = scriptUrl.search ? "&" : "?";
      await import(`${scriptUrl.pathname}${scriptUrl.search}${separator}nav=${Date.now()}`);
      continue;
    }

    if (src) {
      await new Promise((resolve, reject) => {
        const element = document.createElement("script");
        element.src = src;
        if (type) {
          element.type = type;
        }
        element.onload = resolve;
        element.onerror = reject;
        document.body.appendChild(element);
      });
      continue;
    }

    const inline = document.createElement("script");
    if (type) {
      inline.type = type;
    }
    inline.textContent = script.textContent || "";
    document.body.appendChild(inline);
  }
}

async function softNavigate(url, { replace = false, preserveHistory = false, force = false } = {}) {
  const target = new URL(url, window.location.origin);

  if (
    isSoftNavigating ||
    target.origin !== window.location.origin ||
    target.pathname.startsWith("/api")
  ) {
    if (target.origin === window.location.origin) {
      window.location.href = target.href;
    }
    return;
  }

  if (
    !force &&
    target.pathname === window.location.pathname &&
    target.search === window.location.search &&
    target.hash === window.location.hash
  ) {
    return;
  }

  isSoftNavigating = true;

  try {
    const response = await fetch(target.href, {
      headers: {
        "X-Requested-With": "soft-navigation"
      }
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok || !contentType.includes("text/html")) {
      window.location.href = target.href;
      return;
    }

    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const nextBody = parsed.body.cloneNode(true);

    nextBody.querySelectorAll("script").forEach((script) => script.remove());

    document.title = parsed.title;
    document.body.replaceWith(nextBody);

    if (!preserveHistory) {
      if (replace) {
        window.history.replaceState({ soft: true }, "", target.pathname + target.search + target.hash);
      } else {
        window.history.pushState({ soft: true }, "", target.pathname + target.search + target.hash);
      }
    }

    window.scrollTo(0, 0);
    await executeFetchedScripts(parsed.body);
  } catch (error) {
    window.location.href = target.href;
  } finally {
    isSoftNavigating = false;
  }
}

function initSoftNavigation() {
  if (softNavigationBound) {
    return;
  }

  softNavigationBound = true;
  window.history.replaceState({ soft: true }, "", window.location.pathname + window.location.search + window.location.hash);

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a");

    if (!shouldHandleLink(anchor) || isModifiedClick(event)) {
      return;
    }

    event.preventDefault();
    softNavigate(anchor.href);
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const method = (form.getAttribute("method") || "GET").toUpperCase();

    if (method !== "GET" || form.dataset.noSoftNav !== undefined) {
      return;
    }

    const action = form.getAttribute("action") || window.location.pathname;
    const url = new URL(action, window.location.origin);

    if (url.origin !== window.location.origin || url.pathname.startsWith("/api")) {
      return;
    }

    event.preventDefault();

    const params = new URLSearchParams(new FormData(form));
    const query = params.toString();
    softNavigate(`${url.pathname}${query ? `?${query}` : ""}`);
  });

  window.addEventListener("popstate", () => {
    softNavigate(window.location.href, { preserveHistory: true, force: true });
  });
}

export function mountShell(activePage = "") {
  initSoftNavigation();

  const header = document.querySelector("[data-header]");
  const footer = document.querySelector("[data-footer]");
  const user = getCurrentUser();
  const hideShopActions = user?.role === "admin";

  if (header) {
    header.innerHTML = `
      <div class="h-[154px] sm:h-[164px] lg:h-[112px]"></div>
      <header class="fixed inset-x-0 top-0 z-50 border-b border-[#d9d2c6]/85 bg-[rgba(250,246,239,0.86)] backdrop-blur-xl shadow-[0_18px_36px_rgba(16,24,38,0.10)]">
        <div class="shell py-2.5 sm:py-3">
          <div class="panel-soft px-3 py-3 shadow-[0_18px_40px_rgba(16,24,38,0.14),0_0_0_1px_rgba(16,24,38,0.04)] sm:px-5 sm:py-4 lg:px-6">
            <div class="flex items-center justify-between gap-3 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-4">
              <a class="flex min-w-0 items-center gap-3" href="/index.html">
                <span class="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky/15 bg-[linear-gradient(180deg,#fffaf4_0%,#f4ecdf_100%)] text-sky shadow-soft sm:h-11 sm:w-11">
                  <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 4.5 18 8v8l-6 3.5L6 16V8l6-3.5Z" />
                    <path d="M9.25 10.25h5.5" />
                    <path d="M10.1 13h3.8" />
                    <circle cx="17.8" cy="6.2" r="1.4" fill="#db4e2a" stroke="none" />
                  </svg>
                </span>
                <div class="min-w-0">
                  <p class="truncate font-heading text-base tracking-tight text-ink sm:text-xl">ShopSphere</p>
                  <p class="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-slate/55 sm:text-xs">Online store</p>
                </div>
              </a>

              <div class="hidden items-center gap-2 lg:flex lg:justify-center">
                <nav class="no-scrollbar flex w-full items-center gap-2 overflow-x-auto rounded-full border border-[#d9d1c5] bg-[#f4ede2] p-1.5 lg:w-auto lg:justify-center">
                  ${navLink("/index.html", "Home", activePage)}
                  ${navLink("/home.html", "Shop", activePage)}
                  ${navLink("/orders.html", "Orders", activePage)}
                  ${user?.role === "admin" ? navLink("/admin.html", "Admin", activePage) : ""}
                </nav>
              </div>

              <div class="flex items-center gap-2 lg:justify-end">
                ${
                  !hideShopActions
                    ? `
                      <a id="favorites-badge" class="inline-flex h-10 min-w-[44px] items-center justify-center gap-1.5 rounded-full border border-[#d5cec2] bg-[#fffaf4] px-3 text-xs font-semibold text-slate transition hover:border-[#d8a293] hover:text-[#b45309] sm:h-auto sm:gap-2 sm:px-4 sm:py-2 sm:text-sm" href="/home.html?favorites=1">
                        <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M12 20.5 4.8 13.8a4.7 4.7 0 0 1 6.64-6.64L12 7.72l.56-.56a4.7 4.7 0 1 1 6.64 6.64L12 20.5Z" />
                        </svg>
                        <span>0</span>
                      </a>
                      <a id="cart-badge" class="hidden h-10 min-w-[44px] items-center justify-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-white transition hover:bg-[#1b2334] sm:inline-flex sm:h-auto sm:gap-2 sm:px-4 sm:py-2 sm:text-sm" href="/cart.html">
                        <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="9" cy="20" r="1.5"></circle>
                          <circle cx="18" cy="20" r="1.5"></circle>
                          <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 7H7.2"></path>
                        </svg>
                        <span>0</span>
                      </a>
                    `
                    : ""
                }
                ${
                  isAuthenticated() && user
                    ? `
                      <div class="flex items-center gap-2">
                        <a class="hidden h-10 w-10 items-center justify-center rounded-full border border-[#ddd2c4] bg-[#fffaf4]/90 text-sm font-semibold text-slate transition hover:text-sky sm:inline-flex" href="/profile.html">${user.name.charAt(0).toUpperCase()}</a>
                        <a class="hidden max-w-[140px] truncate rounded-full bg-[#fffaf4]/90 px-4 py-2 text-sm font-semibold text-slate transition hover:text-sky sm:inline-flex" href="/profile.html">${user.name}</a>
                        <button id="logout-button" class="hidden btn-secondary !px-4 !py-2.5 !text-xs sm:!inline-flex sm:!text-sm">Logout</button>
                      </div>
                    `
                    : `
                      <a class="hidden h-10 items-center justify-center rounded-full border border-[#d5cec2] bg-[#fffaf4] px-4 text-xs font-semibold text-slate transition hover:border-sky/25 hover:text-sky sm:inline-flex sm:btn-secondary sm:!px-4 sm:!py-2.5 sm:!text-sm" href="/login.html">Login</a>
                    `
                }
              </div>
            </div>

            <form action="/home.html" class="mt-3 grid grid-cols-[1fr_auto] gap-2 sm:hidden">
              <label class="relative block">
                <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate/60">
                  <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"></circle>
                    <path d="m20 20-3.5-3.5"></path>
                  </svg>
                </span>
                <input class="field !rounded-full !bg-[#f8f2e9] !py-3 !pl-10 !pr-4 !text-sm" name="search" type="search" placeholder="Search products" />
              </label>
              <button class="btn-primary !px-4 !py-3 !text-sm" type="submit">Search</button>
            </form>
          </div>
        </div>
      </header>
    `;
  }

  if (footer) {
    footer.innerHTML = `
      <div class="sm:hidden h-20"></div>
      <nav class="sm:hidden fixed inset-x-0 bottom-0 z-50 border-t border-[#d9d2c6] bg-[rgba(250,246,239,0.94)] px-3 py-2 backdrop-blur-xl shadow-[0_-18px_40px_rgba(16,24,38,0.14)]">
        <div class="mx-auto flex max-w-md items-center justify-between rounded-[24px] border border-[#ded6ca] bg-[#fffaf4]/95 px-2 py-2">
          ${mobileNavLink(
            "/index.html",
            "Home",
            '<svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.8V21h14V9.8"></path></svg>',
            activePage
          )}
          ${mobileNavLink(
            "/home.html",
            "Shop",
            '<svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 12H7L6 7Z"></path><path d="M9 7a3 3 0 0 1 6 0"></path></svg>',
            activePage
          )}
          ${mobileNavLink(
            "/orders.html",
            "Orders",
            '<svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>',
            activePage
          )}
          ${mobileNavLink(
            "/cart.html",
            "Cart",
            '<svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"></circle><circle cx="18" cy="20" r="1.5"></circle><path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 7H7.2"></path></svg>',
            activePage
          )}
          ${mobileNavLink(
            user?.role === "admin" ? "/admin.html" : isAuthenticated() ? "/profile.html" : "/login.html",
            user?.role === "admin" ? "Admin" : isAuthenticated() ? "Profile" : "Login",
            '<svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 20a8 8 0 0 1 16 0"></path></svg>',
            activePage
          )}
        </div>
      </nav>
      <footer class="mt-8 hidden bg-[radial-gradient(circle_at_top,rgba(196,106,60,0.18),transparent_28%),linear-gradient(180deg,#111a19_0%,#172322_52%,#22312d_100%)] shadow-[inset_0_1px_0_rgba(196,106,60,0.12),0_-30px_70px_rgba(12,18,20,0.52)] sm:block">
        <div class="mx-auto flex max-w-4xl flex-col items-center px-5 py-10 text-center text-[#ece4d9] sm:px-6">
          <div class="w-full">
            <div class="mx-auto flex max-w-2xl flex-col items-center text-center">
              <div class="flex items-center gap-3">
                <a class="flex h-10 w-10 items-center justify-center rounded-full border border-[#31423e] bg-[#1d2a28] text-[#ece4d9] transition hover:-translate-y-0.5 hover:border-[#c46a3c]/45 hover:text-[#e8a077]" href="/index.html" aria-label="Facebook">
                  <svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.2-1.4 1.4-1.4H16V5.5c-.2 0-.9-.1-1.8-.1-1.8 0-3.1 1.1-3.1 3.2v1.8H9V14h2.3v7h2.2Z"/></svg>
                </a>
                <a class="flex h-10 w-10 items-center justify-center rounded-full border border-[#31423e] bg-[#1d2a28] text-[#ece4d9] transition hover:-translate-y-0.5 hover:border-[#c46a3c]/45 hover:text-[#e8a077]" href="/index.html" aria-label="Twitter">
                  <svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M18.9 7.3c.8-.1 1.5-.6 1.9-1.2-.7.4-1.6.7-2.4.8a3.8 3.8 0 0 0-6.6 2.6c0 .3 0 .6.1.9a10.8 10.8 0 0 1-7.8-4 3.8 3.8 0 0 0 1.2 5 3.7 3.7 0 0 1-1.7-.5v.1a3.8 3.8 0 0 0 3 3.7 3.8 3.8 0 0 1-1.7.1 3.8 3.8 0 0 0 3.5 2.6A7.6 7.6 0 0 1 3 18.6a10.8 10.8 0 0 0 5.8 1.7c7 0 10.8-5.8 10.8-10.8v-.5c.8-.5 1.4-1.1 1.9-1.7-.7.3-1.5.5-2.2.6.7-.5 1.3-1.2 1.6-2.1-.7.4-1.5.7-2.3 1Z"/></svg>
                </a>
                <a class="flex h-10 w-10 items-center justify-center rounded-full border border-[#31423e] bg-[#1d2a28] text-[#ece4d9] transition hover:-translate-y-0.5 hover:border-[#c46a3c]/45 hover:text-[#e8a077]" href="/profile.html" aria-label="LinkedIn">
                  <svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M6.9 8.6A1.6 1.6 0 1 1 7 5.4a1.6 1.6 0 0 1-.1 3.2ZM5.6 9.9h2.7V18H5.6V9.9Zm4.3 0h2.6V11h.1c.4-.7 1.3-1.5 2.7-1.5 2.9 0 3.4 1.9 3.4 4.3V18H16V14.4c0-.9 0-2.1-1.3-2.1s-1.5 1-1.5 2V18H9.9V9.9Z"/></svg>
                </a>
                <a class="flex h-10 w-10 items-center justify-center rounded-full border border-[#31423e] bg-[#1d2a28] text-[#ece4d9] transition hover:-translate-y-0.5 hover:border-[#c46a3c]/45 hover:text-[#e8a077]" href="/index.html" aria-label="Instagram">
                  <svg viewBox="0 0 24 24" class="h-5 w-5 fill-current"><path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm0 2.2A1.8 1.8 0 0 0 5.2 7v10c0 1 .8 1.8 1.8 1.8h10c1 0 1.8-.8 1.8-1.8V7c0-1-.8-1.8-1.8-1.8H7Zm10.3 1.6a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>
                </a>
              </div>

              <nav class="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[14px] font-medium text-[#ece4d9] sm:gap-x-8">
                <a class="tracking-[0.02em] transition hover:text-[#e8a077]" href="/index.html">Home</a>
                <a class="tracking-[0.02em] transition hover:text-[#e8a077]" href="/about.html">About</a>
                <a class="tracking-[0.02em] transition hover:text-[#e8a077]" href="/services.html">Services</a>
                <a class="tracking-[0.02em] transition hover:text-[#e8a077]" href="/team.html">Team</a>
                <a class="tracking-[0.02em] transition hover:text-[#e8a077]" href="/contact.html">Contact</a>
              </nav>

              <p class="mt-5 text-xs font-medium text-[#a6ada7]">
                &copy; 2026 ShopSphere | All Rights Reserved
              </p>
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  const logoutButton = document.querySelector("#logout-button");

  if (logoutButton) {
    logoutButton.addEventListener("click", (event) => {
      event.preventDefault();
      clearSession();
      softNavigate("/index.html", { replace: true });
    });
  }

  refreshFavoritesBadge();

  if (!shellListenersBound) {
    shellListenersBound = true;
    window.addEventListener("favorites:changed", refreshFavoritesBadge);
  }
}

export async function refreshCartBadge() {
  const badge = document.querySelector("#cart-badge");

  if (!badge) {
    return;
  }

  if (!isAuthenticated()) {
    badge.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="20" r="1.5"></circle>
        <circle cx="18" cy="20" r="1.5"></circle>
        <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 7H7.2"></path>
      </svg>
      <span>0</span>
    `;
    return;
  }

  try {
    const cart = await request("/cart", { auth: true });
    badge.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="20" r="1.5"></circle>
        <circle cx="18" cy="20" r="1.5"></circle>
        <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 7H7.2"></path>
      </svg>
      <span>${cart.itemCount}</span>
    `;
  } catch (error) {
    badge.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="20" r="1.5"></circle>
        <circle cx="18" cy="20" r="1.5"></circle>
        <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 7H7.2"></path>
      </svg>
      <span>0</span>
    `;
  }
}

export function refreshFavoritesBadge() {
  const badge = document.querySelector("#favorites-badge");

  if (!badge) {
    return;
  }

  badge.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-none stroke-current" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20.5 4.8 13.8a4.7 4.7 0 0 1 6.64-6.64L12 7.72l.56-.56a4.7 4.7 0 1 1 6.64 6.64L12 20.5Z" />
    </svg>
    <span>${getFavoriteCount()}</span>
  `;
}
