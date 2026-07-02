require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

module.exports = {
  PORT: process.env.PORT || 5051,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || "construction_secret_dev_only",
  NODE_ENV: process.env.NODE_ENV || "development",
};