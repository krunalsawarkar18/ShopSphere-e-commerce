import { syncCurrentUser } from "../modules/auth.js";
import { mountShell, refreshCartBadge } from "../modules/layout.js";

mountShell("");
await syncCurrentUser();
await refreshCartBadge();
