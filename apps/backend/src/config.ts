function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Check apps/backend/.env`);
  }
  return value;
}

export const config = {
  jwtSecret: required("JWT_SECRET"),
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlDays: 7,
};
