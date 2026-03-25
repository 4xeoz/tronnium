import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { appConfig } from "../config/config";
import type { PublicUser } from "../services/user.service";
import { userService } from "../services/user.service";

export function googleAuthHandler(req: Request, res: Response) {
  // This will redirect to Google
  // Handled by Passport
}

export function googleAuthCallbackHandler(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication failed." });
  }

  const user = req.user as PublicUser;

  const token = jwt.sign(
    {
      sub: user.id,
      username: user.name,
      role: user.role,
    },
    appConfig.jwtSecret,
    { expiresIn: appConfig.jwtExpiresIn }
  );

  // Set httpOnly cookie
res.cookie("token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 1000,
  path: "/",            // make it easy to clear
  sameSite: "lax",      // or 'none' if cross-site and HTTPS
  // do NOT set domain: 'localhost' for local dev
});

  // Redirect to frontend environments page
  return res.redirect(`${appConfig.frontendUrl}/environments`);
}

export async function profileHandler(req: Request, res: Response) {
  console.log("Profile handler called, jwt successful, payload:", req.user);
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated." });
  }

  // Fetch fresh user data from database to include devMode
  const userId = (req.user as PublicUser).id;
  const user = await userService.findById(userId);
  
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const publicUser = userService.toPublic(user);

  return res.json(
    {
      success: true,
      data: publicUser,
      message: "User profile fetched successfully.",
    }
  );
}


export function logoutHandler() {
  return (_req: Request, res: Response) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",        // must match set cookie
      sameSite: "lax",
    });
    return res.json({ success: true, message: "Logged out successfully." });
  };
}

export async function toggleDevModeHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }

    const updatedUser = await userService.toggleDevMode(userId);
    const publicUser = userService.toPublic(updatedUser);

    return res.json({
      success: true,
      data: publicUser,
      message: `Dev mode ${publicUser.devMode ? "enabled" : "disabled"} successfully.`,
    });
  } catch (error) {
    console.error("Toggle dev mode error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to toggle dev mode.",
    });
  }
}