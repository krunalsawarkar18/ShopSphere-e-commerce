const FAVORITES_KEY = "shopsphere_favorites";

function readFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  window.dispatchEvent(
    new CustomEvent("favorites:changed", {
      detail: { count: favorites.length }
    })
  );
}

export function getFavoriteIds() {
  return readFavorites();
}

export function isFavorite(productId) {
  return readFavorites().includes(String(productId));
}

export function toggleFavorite(productId) {
  const targetId = String(productId);
  const favorites = readFavorites();
  const nextFavorites = favorites.includes(targetId)
    ? favorites.filter((id) => id !== targetId)
    : [...favorites, targetId];

  writeFavorites(nextFavorites);
  return nextFavorites;
}

export function renderFavoriteButton(button, active) {
  button.classList.toggle("text-rose-500", active);
  button.classList.toggle("bg-rose-50", active);
  button.classList.toggle("border-rose-100", active);
  button.classList.toggle("text-slate", !active);
  const icon = button.querySelector("svg");

  if (icon) {
    icon.classList.toggle("fill-rose-500", active);
    icon.classList.toggle("fill-none", !active);
  }

  button.setAttribute("aria-label", active ? "Remove from favourites" : "Add to favourites");
}

export function syncFavoriteButtons(scope = document) {
  scope.querySelectorAll("[data-favorite-button]").forEach((button) => {
    const productId = button.getAttribute("data-product-id");

    if (!productId) {
      return;
    }

    renderFavoriteButton(button, isFavorite(productId));

    if (button.dataset.favoriteBound === "true") {
      return;
    }

    button.dataset.favoriteBound = "true";
    button.addEventListener("click", () => {
      const nextFavorites = toggleFavorite(productId);
      renderFavoriteButton(button, nextFavorites.includes(String(productId)));
      syncFavoriteButtons(document);
    });
  });
}

export function getFavoriteCount() {
  return readFavorites().length;
}
