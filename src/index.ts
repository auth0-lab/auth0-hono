export { auth } from "@/auth.js";

export type { OIDCEnv, OIDCVariables } from "@/lib/honoEnv.js";
export { type OIDCSession } from "@/types/session.js";
export { type UserInfoResponse as UserInfo } from "openid-client";

export {
  attemptSilentLogin,
  backchannelLogout,
  callback,
  login,
  logout,
  pauseSilentLogin,
  requiresAuth,
  resumeSilentLogin,
} from "@/middleware/index.js";

export type { TokenEndpointResponse as TokenSet } from "openid-client";

export { OIDCException } from "@/lib/Exception.js";
