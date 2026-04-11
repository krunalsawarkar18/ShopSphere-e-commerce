const ORDER_SYNC_KEY = "shopsphere:order-sync";
const ORDER_SYNC_CHANNEL = "shopsphere-order-sync";

let orderChannel = null;

function getChannel() {
  if (orderChannel || typeof BroadcastChannel === "undefined") {
    return orderChannel;
  }

  orderChannel = new BroadcastChannel(ORDER_SYNC_CHANNEL);
  return orderChannel;
}

export function publishOrderSync(detail = {}) {
  const payload = {
    type: "order-updated",
    timestamp: Date.now(),
    ...detail
  };

  try {
    localStorage.setItem(ORDER_SYNC_KEY, JSON.stringify(payload));
  } catch {}

  try {
    getChannel()?.postMessage(payload);
  } catch {}
}

export function subscribeToOrderSync(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  const handlePayload = (payload) => {
    if (payload?.type === "order-updated") {
      callback(payload);
    }
  };

  const handleStorage = (event) => {
    if (event.key !== ORDER_SYNC_KEY || !event.newValue) {
      return;
    }

    try {
      handlePayload(JSON.parse(event.newValue));
    } catch {}
  };

  const channel = getChannel();
  const handleMessage = (event) => {
    handlePayload(event.data);
  };

  window.addEventListener("storage", handleStorage);
  channel?.addEventListener("message", handleMessage);

  return () => {
    window.removeEventListener("storage", handleStorage);
    channel?.removeEventListener("message", handleMessage);
  };
}
