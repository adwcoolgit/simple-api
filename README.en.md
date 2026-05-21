# Simple API

![CI](https://github.com/adwcoolgit/simple-api/workflows/CI/badge.svg)

A modern REST API built with Bun, Elysia, Drizzle ORM, and MySQL for user authentication and comprehensive product, inventory, pricing, and variant management.

## A. Application Overview

This application provides a complete user authentication system along with comprehensive product management including variants, inventory, pricing, costs, barcodes, taxes, and product images. The API uses UUID-based session tokens instead of traditional JWT for simplicity and security.

### Key Features:

- User registration with email validation
- Secure login with bcrypt password hashing
- Session-based authentication with UUID tokens
- Protected routes for authenticated users
- Comprehensive input validation and error handling
- Type-safe database operations with Drizzle ORM
- Full product lifecycle management

## B. Features

### Authentication & Users

- **User Registration** - Secure registration with email validation
- **Login & Sessions** - UUID session tokens + bcrypt password hashing
- **Authentication Middleware** - Route protection with Bearer tokens

### Product & Inventory Management

- **Products** - Full CRUD with categories and departments
- **Product Variants** - SKU, variant name, UOM, and variant attributes
- **Inventory** - Multi-warehouse stock management with reserved quantity
- **Product Pricing** - Retail, Member, Reseller pricing with date ranges
- **Product Costs** - Cost tracking with effective dates
- **Barcodes** - Per-variant barcode management
- **Product Taxes** - Tax code and inclusive/exclusive configuration
- **Product Images** - Multiple images with primary flag

### Infrastructure & Quality

- **TypeScript** - Full type safety with strict type checking
- **Comprehensive Testing** - 370+ unit tests with high coverage
- **Drizzle ORM** - Type-safe query builder with MySQL

## C. Project Structure

```
simple-api/
├── src/
│   ├── cache/
│   │   └── redis.ts
│   ├── db/
│   │   ├── index.ts
│   │   ├── replica.ts
│   │   └── schema.ts          # Complete schema (users, products, variants, inventory, prices, etc.)
│   ├── lib/
│   │   └── metrics.ts
│   ├── middleware/
│   │   ├── auth-middleware.ts
│   │   ├── logger.ts
│   │   └── rate-limit.ts
│   ├── routes/                # All routes (users, products, variants, inventory, prices, etc.)
│   ├── service/               # Business logic for all modules
│   └── index.ts
├── tests/                     # 370+ unit tests
├── scripts/
│   └── seed-data.ts           # Realistic data seeder
├── package.json
├── README.md
└── .env
```

### Naming Conventions

- **Files**: kebab-case (e.g., `users-route.ts`, `auth-middleware.ts`)
- **Variables/Functions**: camelCase
- **Classes/Types**: PascalCase
- **Database Tables**: snake_case (e.g., `product_variants`)
- **API Endpoints**: RESTful with kebab-case resources

## D. Technologies Used

- **Runtime:** [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Framework:** [Elysia](https://elysiajs.com/) - Modern web framework
- **ORM:** [Drizzle](https://orm.drizzle.team/) - Type-safe SQL query builder
- **Database:** MySQL 8.0+
- **Authentication:** bcrypt + UUID sessions
- **Language:** TypeScript

## E. Libraries Used

### Core Dependencies

- **[Elysia](https://elysiajs.com/)** - Web framework for building APIs
- **[Drizzle ORM](https://orm.drizzle.team/)** - Type-safe SQL query builder
- **[mysql2](https://github.com/sidorares/node-mysql2)** - MySQL database driver
- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)** - Password hashing library

### Development Dependencies

- **[@types/bcryptjs](https://github.com/DefinitelyTyped/DefinitelyTyped)** - TypeScript types for bcryptjs
- **[@types/bun](https://github.com/oven-sh/bun)** - TypeScript types for Bun runtime
- **[drizzle-kit](https://orm.drizzle.team/kit)** - Migration and database studio tool

## F. Database Schema

The application uses multiple interconnected tables:

### Main Tables

- **users** & **sessions** — Authentication and session management
- **products** — Product master data
- **product_variants** — Variants with SKU
- **warehouses** — Warehouse locations
- **inventory** — Stock per variant per warehouse (with reserved quantity)
- **product_prices** — Retail/member/reseller pricing with date ranges
- **product_costs** — Cost tracking with effective dates
- **barcodes** — Barcodes per variant
- **product_taxes** — Tax configuration
- **product_images** — Product images (multiple + primary)
- **variant_attributes** — Variant attributes (color, size, etc.)

All tables use strict foreign keys and unique constraints to maintain data integrity.

## G. Prerequisites

- [Bun](https://bun.sh/docs/installation) installed
- MySQL 8.0+ server running

## H. Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd simple-api
bun install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=simple_api
DB_USER=your_mysql_user
DB_PASSWORD=your_secure_password

# Server Configuration
PORT=3000
```

### 3. Database Setup

Create the database and run migrations:

```bash
# Create database (if not exists)
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS simple_api"

# Generate and run migrations
bun run db:generate
bun run db:migrate
```

### 4. Start Development Server

```bash
bun run dev
```

The API will be available at `http://localhost:3000`

### 5. Run Tests (Optional)

Verify everything works by running the test suite:

```bash
bun test
```

All 377+ tests should pass, confirming API functionality.

## I. Available API Endpoints

All API endpoints are prefixed with `/api` and return JSON responses.

### Health Check

```
GET /health
```

**Response:** `200 OK` with basic server status

### User Registration

```
POST /api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Validation:**

- `name`: Required, max 255 characters
- `email`: Required, valid email format, max 255 characters
- `password`: Required, min 8 characters, max 255 characters

### User Login

```
POST /api/users/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Success Response (200):**

```json
{
  "data": {
    "token": "uuid-string-here"
  }
}
```

### Get Current User

```
GET /api/users/current
Authorization: Bearer <uuid-token>
```

**Success Response (200):**

```json
{
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2026-04-27T07:22:33.000Z"
  }
}
```

### Logout User

```
DELETE /api/users/logout
Authorization: Bearer <uuid-token>
```

**Success Response (200):**

```json
{
  "data": "OK"
}
```

### Error Responses

All endpoints return structured error responses:

```json
{
  "error": "Error message in English"
}
```

Common status codes: `400` (Bad Request), `401` (Unauthorized), `409` (Conflict), `422` (Validation Error)

## J. Running the Application

### Development Mode

```bash
bun run dev
```

Starts the development server with hot reload at `http://localhost:3000`

### Production Mode

```bash
bun run start
```

Runs the application in production mode (`NODE_ENV=production`)

## K. Testing the Application

The project includes a very comprehensive test suite.

### Run Tests

```bash
bun test
```

Currently there are **377+ passing tests** with 0 failures, covering:

- Authentication & user management
- All product, variant, inventory, pricing, cost, barcode, tax, and image modules
- Edge cases and error handling
- Type safety validation

### Test Coverage

- **Users & Auth**: Registration, login, current user, logout
- **Products & Variants**: Full CRUD + variant attributes
- **Inventory**: Multi-warehouse stock management
- **Pricing & Costs**: Effective date pricing & costing
- **Barcodes, Taxes & Images**: Per-variant management
- **Type Safety**: All services and routes have been type-fixed

## L. Development Scripts

```bash
bun run dev              # Start development server with hot reload
bun run start            # Run production server
bun run db:generate      # Generate Drizzle migrations
bun run db:migrate       # Run database migrations
bun run db:studio        # Open Drizzle Studio
bun run db:setup         # Setup database tables
bun test                 # Run full test suite (377+ tests)
```

## M. Security & Quality Features

- **Type Safety:** TypeScript strict mode + extensive type fixes
- **Password Hashing:** bcrypt with 12 rounds
- **Session Tokens:** UUID-based (not JWT)
- **Input Validation:** Elysia schema validation
- **SQL Injection Protection:** Parameterized queries via Drizzle
- **Comprehensive Testing:** 100% error-free test suite
- **No Sensitive Data Leakage:** Passwords and sensitive data are never exposed in responses

## N. Acknowledgments

- [Bun](https://bun.sh/) - Fast JavaScript runtime
- [Elysia](https://elysiajs.com/) - Elegant web framework
- [Drizzle](https://orm.drizzle.team/) - Type-safe ORM
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) - Password hashing library
