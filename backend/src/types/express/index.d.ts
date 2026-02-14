import type { PublicUser } from "../../services/user.service";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends PublicUser {}
  }
}

export {
PublicUser
};
