# Database Setup

This folder contains database-related files for the Construction Portal backend.

## Files

- `pool.js`  
  PostgreSQL connection pool used by backend modules.

- `schema.sql`  
  SQL table definitions for the application database.

## Main Tables

- users
- companies
- company_users
- payments
- workers
- sites
- tenders
- invoices
- daily_site_logs
- worker_allocations
- worker_expenses

## Notes

The backend uses PostgreSQL with the `pg` package.

The database connection is loaded from:

DATABASE_URL

inside the backend `.env` file.

## Current Purpose

This schema supports:

- authentication
- company structure
- payment tracking
- worker management
- site management
- tender tracking
- invoice tracking
- daily site updates
- worker allocations
- worker expenses