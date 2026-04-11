export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function showMessage(element, message, type = "error") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.remove("hidden", "bg-red-100", "text-red-700", "bg-emerald-100", "text-emerald-700");

  if (type === "success") {
    element.classList.add("bg-emerald-100", "text-emerald-700");
  } else {
    element.classList.add("bg-red-100", "text-red-700");
  }
}

export function clearMessage(element) {
  if (!element) {
    return;
  }

  element.textContent = "";
  element.classList.add("hidden");
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
