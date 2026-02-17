import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt, type StrategyOptions, type VerifiedCallback } from "passport-jwt";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { JwtPayload } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { appConfig } from "../config/config";
import { userService } from "../services/user.service";

const cookieExtractor = (req: any) => {
  const token = req?.cookies?.token ?? null;
  console.log("[JWT] Cookie token:", token ? "found" : "not found");
  console.log("[JWT] token:", token);
  return token;
};

let isConfigured = false;

export function configurePassport() {
  if (isConfigured) {
    return;
  }

  // JWT Strategy
  const jwtOptions: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor, ExtractJwt.fromAuthHeaderAsBearerToken()]),
    secretOrKey: appConfig.jwtSecret as string,
  };

  passport.use(
    new JwtStrategy(jwtOptions, async (payload : JwtPayload , done ) => {
      try {
        console.log("[JWT] Verifying payload:", payload.sub);
        
        if (!payload.sub) {
          return done(new Error("Invalid JWT payload: missing subject"), false);
        }

        const user = await userService.findById(payload.sub);
        if (!user) {
          console.log("[JWT] User not found for ID:", payload.sub);
          return done(null, false);
        }

        console.log("[JWT] User authenticated:", user.id);
        return done(null, userService.toPublic(user));
        
      } catch (error) {
        console.error("[JWT] Error:", error);
        return done(error as Error, false);
        
      }
    })
  );

  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: appConfig.googleClientId,
        clientSecret: appConfig.googleClientSecret,
        callbackURL: appConfig.googleCallbackUrl,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await userService.findOrCreateByGoogleProfile(profile);
          return done(null, userService.toPublic(user));
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );

  isConfigured = true;
  console.log("[Passport] Configured successfully");
}

// Updated jwtAuthGuard with proper error handling to prevent hanging requests
export function jwtAuthGuard() {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log("[JWT Guard] Authenticating request to:", req.path);
    
    passport.authenticate("jwt", { session: false }, (err: Error | null, user: any, info: any) => {
      if (err) {
        console.error("[JWT Guard] Error:", err);
        return res.status(500).json({ error: "Authentication error" });
      }
      
      if (!user) {
        console.log("[JWT Guard] No user found. Info:", info?.message || info);
        return res.status(401).json({ error: "Unauthorized", message: info?.message || "Invalid or missing token" });
      }
      
      console.log("[JWT Guard] User authenticated:", user.id);
      req.user = user;
      next();
    })(req, res, next);
  };
}
