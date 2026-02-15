import type { Request, Response, Router } from "express";
import * as crypto from "crypto";
import type { ModulePlugin } from "pravatv_scaffold";

type TokenValidationResult = {
  isValid: boolean;
  message: string;
};

function validateToken(
  token: string,
  linkSecret: string,
): TokenValidationResult {
  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) {
      return { isValid: false, message: "Invalid token format" };
    }

    const payload = Buffer.from(payloadB64, "base64url").toString();

    const expectedSig = crypto
      .createHmac("sha256", linkSecret)
      .update(payload)
      .digest("base64url");

    const a = Buffer.from(signature, "base64url");
    const b = Buffer.from(expectedSig, "base64url");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { isValid: false, message: "Invalid signature" };
    }

    const [userId, validUntil] = payload.split(":");
    if (!userId) {
      return { isValid: false, message: "User ID is missing" };
    }

    if (!validUntil) {
      return { isValid: false, message: "Valid until is missing" };
    }

    const validUntilSec = Number.parseInt(validUntil, 10);
    if (!Number.isFinite(validUntilSec)) {
      return { isValid: false, message: `Invalid valid until for user ${userId}` };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const validUntilUtc = new Date(validUntilSec * 1000).toISOString();
    if (nowSec > validUntilSec) {
      return {
        isValid: false,
        message: `Token expired at ${validUntilUtc} for user ${userId}`,
      };
    }

    return {
      isValid: true,
      message: `Token is valid until ${validUntilUtc} for user ${userId}`,
    };
  } catch {
    return { isValid: false, message: "Error validating token" };
  }
}

const plugin: ModulePlugin = {
  config: {
    name: "token",
    basePath: "/token"
  },
  register(router: Router, logger: any) {
    const linkSecret = process.env.TOKEN_SECRET;
    if (!linkSecret) {
      throw new Error("TOKEN_SECRET is required");
    }

    router.options("/validate", (_req: Request, res: Response) => {
      res.status(204).end();
    });

    router.get("/validate", (req: Request, res: Response) => {
      try {
        const token = req.query.token ?? req.query.t;
        if (typeof token !== "string" || token.length === 0) {
          logger.warn("/validate missing or invalid token query parameter");
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        const result = validateToken(token, linkSecret);

        if (result.isValid) {
          logger.info(`/validate success: ${result.message}`);
          res.status(200).send();
        } else {
          logger.warn(`/validate failed: ${result.message}`);
          res.status(401).json({ error: 'Unauthorized' });
        }
      } catch (err) {
        logger.warn(
          `/validate failed reason=${err instanceof Error ? err.message : String(err)}`,
        );
        res.status(401).json({ error: "Unauthorized" });
      }
    });
  },
};

export default plugin;
