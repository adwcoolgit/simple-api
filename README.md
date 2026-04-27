# Simple API

A modern REST API built with Bun, Elysia, Drizzle ORM, and MySQL for user authentication and management.

## ?? Features

- **User Registration** - Secure user signup with email validation
- **User Login** - JWT-like session tokens with UUID  
- **Current User** - Get authenticated user information
- **User Logout** - Secure session termination
- **Database Migrations** - Drizzle ORM with MySQL
- **TypeScript** - Full type safety throughout the application

## ??? Tech Stack

- **Runtime:** [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Framework:** [Elysia](https://elysiajs.com/) - Modern web framework
- **ORM:** [Drizzle](https://orm.drizzle.team/) - Type-safe SQL queries
- **Database:** MySQL 8.0+
- **Authentication:** bcrypt + UUID sessions
- **Language:** TypeScript

## ?? Prerequisites

- [Bun](https://bun.sh/docs/installation) installed
- MySQL 8.0+ server running

## ?? Quick Start

### 1. Clone and Install

`ash
git clone <repository-url>
cd simple-api
bun install
`

### 2. Environment Setup

Copy the example environment file:

`ash
cp .env.example .env
`

Edit .env with your database credentials:

`env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=simple_api
DB_USER=your_mysql_user
DB_PASSWORD=your_secure_password

# Server Configuration
PORT=3000
`

### 3. Database Setup

Create the database and run migrations:

`ash
# Create database (if not exists)
mysql -u root -p -e " CREATE DATABASE IF NOT EXISTS simple_api\

# Generate and run migrations
bun run db:generate
bun run db:migrate
`

### 4. Start Development Server

`ash
bun run dev
`

The API will be available at http://localhost:3000

## ?? API Endpoints

### Health Check
`http
GET /health
`

### User Registration
`http
POST /api/users
Content-Type: application/json

{
 \name\: \John Doe\,
 \email\: \john@example.com\, 
 \password\: \securepassword123\
}
`

### User Login
`http
POST /api/users/login
Content-Type: application/json

{
 \email\: \john@example.com\,
 \password\: \securepassword123\
}
`

### Get Current User
`http
GET /api/users/current
Authorization: Bearer <uuid-token>
`

### User Logout
`http
DELETE /api/users/logout
Authorization: Bearer <uuid-token>
`

## ?? Development Scripts

`ash
bun run dev # Start development server
bun run db:generate # Generate database migrations
bun run db:migrate # Run database migrations
bun run db:studio # Open Drizzle Studio
`

## ?? Security Features

- **Password Hashing:** bcrypt with 12 rounds
- **Session Tokens:** UUID-based (not JWT)
- **Input Validation:** Elysia schema validation
- **SQL Injection Protection:** Drizzle ORM parameterized queries
- **No Password Leakage:** Passwords never returned in responses

## ?? Acknowledgments

- [Bun](https://bun.sh/) - Fast JavaScript runtime
- [Elysia](https://elysiajs.com/) - Elegant web framework 
- [Drizzle](https://orm.drizzle.team/) - Type-safe ORM
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) - Password hashing

