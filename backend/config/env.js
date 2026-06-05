require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 5051,

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_SECRET:
    process.env.JWT_SECRET || "construction_secret",

  NODE_ENV:
    process.env.NODE_ENV || "development",
};