# Arthwell

Arthwell is an Internal Collection & Loan Management System built with Next.js 16.3.4 (Turbopack) and Prisma ORM.

## Architecture
- **Framework**: Next.js (App Router)
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Prisma Client

## Setup & Migration
The production database is strictly PostgreSQL. All historical SQLite fallback engines have been permanently archived.
Prisma migrations are strictly enforced. Environment variables `PG_DATABASE_URL` and `PG_DIRECT_URL` are required for connectivity.