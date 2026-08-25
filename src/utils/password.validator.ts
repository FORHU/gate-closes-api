import Joi from "joi";

/**
 * Shared password rule, mirrored from the mobile app's client-side check
 * (features/auth/utils/passwordValidation.ts): min 8 chars, at least one
 * uppercase letter, one digit, and one special character. Enforced here too
 * since client-side validation alone is trivially bypassed by calling the
 * API directly.
 */
export const passwordSchema = Joi.string()
  .min(8)
  .pattern(/[A-Z]/, "an uppercase letter")
  .pattern(/\d/, "a number")
  .pattern(/[^a-zA-Z0-9\s]/, "a special character")
  .required()
  .messages({
    "string.min": "Password must be at least 8 characters",
    "string.pattern.name": "Password must contain at least one {#name}",
  });
