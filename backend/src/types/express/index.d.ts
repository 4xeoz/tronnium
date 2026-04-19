import type { PublicUser } from "../../types/user.types";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends PublicUser {}
  }
}

export {
PublicUser
};
