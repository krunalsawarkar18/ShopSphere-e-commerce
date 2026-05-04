import { syncCurrentUser } from "./auth.js";
import { mountShell, refreshCartBadge } from "./layout.js";

export function bootstrapShell(activePage = "") {
  mountShell(activePage);

  const userPromise = syncCurrentUser()
    .then((user) => {
      mountShell(activePage);
      return user;
    })
    .catch(() => {
      mountShell(activePage);
      return null;
    });

  const cartPromise = userPromise.finally(() => refreshCartBadge());

  return {
    userPromise,
    cartPromise,
    ready: Promise.allSettled([userPromise, cartPromise])
  };
}
