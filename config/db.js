//require("dotenv").config({ path: "../.env" });
require('dotenv').config();
const { Pool } = require("pg");

const hasDatabaseUrl = !!process.env.DATABASE_URL;

const pool = hasDatabaseUrl
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASS,
      port: Number(process.env.DB_PORT || 5432),
    });

module.exports = pool;
