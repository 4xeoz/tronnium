import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { appConfig } from "../config/config";
import type { PublicUser } from "../services/user.service";

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

  // Redirect to frontend
  return res.redirect(appConfig.frontendUrl);
}

export function profileHandler(req: Request, res: Response) {
  console.log("Profile handler called, jwt successful, payload:", req.user);
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated." });
  }

  const user = req.user as PublicUser;

  return res.json({
    email: user.email,
    name: user.name,
    role: user.role,
  });
}


export function logoutHandler() {
  return (_req: Request, res: Response) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",        // must match set cookie
      sameSite: "lax",
    });
    return res.json({ success: true });
  };
}