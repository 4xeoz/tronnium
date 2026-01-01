import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt, type StrategyOptions, type VerifiedCallback } from "passport-jwt";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { JwtPayload } from "jsonwebtoken";
import { appConfig } from "../config/config";
import { userService } from "../services/user.service";

const cookieExtractor = (req: any) => {
  return req?.cookies?.token ?? null;
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
        if (!payload.sub) {
          return done(new Error("Invalid JWT payload: missing subject"), false);
        }

        const user = await userService.findById(payload.sub);
        if (!user) {
          return done(null, false);
        }

        return done(null, userService.toPublic(user));
        
      } catch (error) {
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
}

export function jwtAuthGuard() {
  console.log("Applying JWT auth guard");
  return passport.authenticate("jwt", { session: false });
}
