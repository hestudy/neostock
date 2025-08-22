import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_AUTH_TOKEN: z.string().optional(),

  // External APIs
  TUSHARE_TOKEN: z.string().optional(),
  BACKUP_API_KEY: z.string().optional(),

  // Authentication
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),

  // Environment
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Monitoring
  MONITORING_ENABLED: z.string().transform((val) => val === "true").default("true"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),

  // Security
  API_RATE_LIMIT_ENABLED: z.string().transform((val) => val === "true").default("true"),
  API_RATE_LIMIT_REQUESTS: z.string().transform((val) => parseInt(val)).default("100"),
  API_RATE_LIMIT_WINDOW_MS: z.string().transform((val) => parseInt(val)).default("900000"),

  // Testing
  TEST_DATABASE_URL: z.string().optional(),

  // Deployment
  DEPLOY_TARGET: z.enum(["development", "staging", "production"]).default("development"),
  HEALTH_CHECK_ENABLED: z.string().transform((val) => val === "true").default("true"),
  HEALTH_CHECK_TIMEOUT: z.string().transform((val) => parseInt(val)).default("5000"),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

export function validateEnv() {
  try {
    env = envSchema.parse(process.env);
    console.log(`✅ Environment validation successful (${env.NODE_ENV})`);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

export function getEnv(): Env {
  if (!env) {
    env = validateEnv();
  }
  return env;
}

export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === "development";
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

export function isTest(): boolean {
  return getEnv().NODE_ENV === "test";
}