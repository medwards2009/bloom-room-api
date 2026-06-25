import * as Joi from 'joi';

/**
 * Validates process env at boot so the app fails fast on missing/malformed
 * config instead of dying later with a confusing runtime error.
 *
 * AUTH_DEV_MODE relaxes the auth requirements for local work: a weak JWT secret
 * is allowed and GOOGLE_CLIENT_IDS becomes optional (the dev token verifier
 * doesn't call Google). In any non-dev environment both are strictly required.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(8080),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().default('bloom'),
  DB_PASSWORD: Joi.string().default('secret'),
  DB_NAME: Joi.string().default('bloom_room_dev'),

  AUTH_DEV_MODE: Joi.boolean().default(false),
  JWT_SECRET: Joi.string().when('AUTH_DEV_MODE', {
    is: true,
    then: Joi.string().min(8).required(),
    otherwise: Joi.string().min(32).required(),
  }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  GOOGLE_CLIENT_IDS: Joi.string().when('AUTH_DEV_MODE', {
    is: true,
    then: Joi.string().allow('').optional(),
    otherwise: Joi.string().required(),
  }),
});
