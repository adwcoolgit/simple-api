# Simple API

Sebuah REST API modern yang dibangun dengan Bun, Elysia, Drizzle ORM, dan MySQL untuk autentikasi dan manajemen pengguna.

## 📋 Gambaran Aplikasi

Aplikasi ini menyediakan sistem autentikasi pengguna yang lengkap dengan registrasi, login, manajemen sesi, dan logout. Ini berfungsi sebagai API backend untuk aplikasi web/mobile yang memerlukan akun pengguna yang aman. API menggunakan token sesi berbasis UUID daripada JWT tradisional untuk kesederhanaan dan keamanan.

Fitur utama:
- Registrasi pengguna dengan validasi email
- Login aman dengan hashing password bcrypt
- Autentikasi berbasis sesi dengan token UUID
- Route terlindungi untuk pengguna terautentikasi
- Validasi input komprehensif dan penanganan error
- Operasi database yang aman tipe dengan Drizzle ORM

## ?? Fitur

- **Registrasi Pengguna** - Pendaftaran pengguna aman dengan validasi email
- **Login Pengguna** - Token sesi dengan UUID
- **Pengguna Saat Ini** - Dapatkan informasi pengguna terautentikasi
- **Logout Pengguna** - Penghentian sesi aman
- **Migrasi Database** - Drizzle ORM dengan MySQL
- **TypeScript** - Keamanan tipe penuh di seluruh aplikasi

## 🏗️ Struktur Proyek

```
simple-api/
├── src/
│   ├── db/
│   │   ├── index.ts      # Pengaturan koneksi database
│   │   └── schema.ts     # Definisi tabel database
│   ├── routes/
│   │   ├── auth-middleware.ts  # Middleware autentikasi
│   │   ├── index.ts      # Indeks route
│   │   └── users-route.ts # Route API terkait pengguna
│   ├── service/
│   │   └── users-service.ts # Logika bisnis pengguna
│   └── index.ts          # Titik masuk aplikasi
├── tests/
│   └── users.test.ts     # Tes unit komprehensif
├── package.json
├── README.md
└── .env                  # Variabel lingkungan (tidak di-commit)
```

### Konvensi Penamaan

- **File**: kebab-case (misalnya `users-route.ts`, `auth-middleware.ts`)
- **Variabel/Fungsi**: camelCase
- **Kelas/Tipe**: PascalCase
- **Tabel Database**: snake_case (misalnya `user_sessions`)
- **Endpoint API**: RESTful dengan resource kebab-case

## ??? Teknologi yang Digunakan

- **Runtime:** [Bun](https://bun.sh/) - Runtime JavaScript yang cepat
- **Framework:** [Elysia](https://elysiajs.com/) - Framework web modern
- **ORM:** [Drizzle](https://orm.drizzle.team/) - Query SQL yang aman tipe
- **Database:** MySQL 8.0+
- **Autentikasi:** bcrypt + sesi UUID
- **Bahasa:** TypeScript

## 📚 Library yang Digunakan

### Dependensi Utama
- **[Elysia](https://elysiajs.com/)** - Framework web untuk membangun API
- **[Drizzle ORM](https://orm.drizzle.team/)** - Builder query SQL yang aman tipe
- **[mysql2](https://github.com/sidorares/node-mysql2)** - Driver database MySQL
- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)** - Library hashing password

### Dependensi Pengembangan
- **[@types/bcryptjs](https://github.com/DefinitelyTyped/DefinitelyTyped)** - Tipe TypeScript untuk bcryptjs
- **[@types/bun](https://github.com/oven-sh/bun)** - Tipe TypeScript untuk runtime Bun
- **[drizzle-kit](https://orm.drizzle.team/kit)** - Alat migrasi dan studio database

## 🗄️ Skema Database

Aplikasi menggunakan dua tabel utama:

### Tabel Users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabel Sessions
```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

- **users**: Menyimpan informasi akun pengguna dengan kendala email unik
- **sessions**: Menyimpan token autentikasi yang terhubung dengan pengguna (berbasis UUID)

## ?? Prasyarat

- [Bun](https://bun.sh/docs/installation) terinstal
- Server MySQL 8.0+ berjalan

## ?? Mulai Cepat

### 1. Clone dan Install

```bash
git clone <repository-url>
cd simple-api
bun install
```

### 2. Pengaturan Lingkungan

Salin file environment contoh:

```bash
cp .env.example .env
```

Edit .env dengan kredensial database Anda:

```env
# Konfigurasi Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=simple_api
DB_USER=user_mysql_anda
DB_PASSWORD=password_aman_anda

# Konfigurasi Server
PORT=3000
```

### 3. Pengaturan Database

Buat database dan jalankan migrasi:

```bash
# Buat database (jika belum ada)
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS simple_api"

# Generate dan jalankan migrasi
bun run db:generate
bun run db:migrate
```

### 4. Jalankan Server Pengembangan

```bash
bun run dev
```

API akan tersedia di `http://localhost:3000`

### 5. Jalankan Tes (Opsional)

Verifikasi semuanya berfungsi dengan menjalankan suite tes:

```bash
bun test
```

Semua 35 tes harus lulus, mengkonfirmasi fungsionalitas API.

## 🔌 Endpoint API yang Tersedia

Semua endpoint API diawali dengan `/api` dan mengembalikan respons JSON.

### Health Check
```http
GET /health
```
**Respons:** `200 OK` dengan status server dasar

### Registrasi Pengguna
```http
POST /api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```
**Validasi:**
- `name`: Wajib, maks 255 karakter
- `email`: Wajib, format email valid, maks 255 karakter
- `password`: Wajib, min 8 karakter, maks 255 karakter

**Respons Sukses (200):**
```json
{
  "data": "Success"
}
```

### Login Pengguna
```http
POST /api/users/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword123"
}
```
**Respons Sukses (200):**
```json
{
  "data": {
    "token": "uuid-string-here"
  }
}
```

### Dapatkan Pengguna Saat Ini
```http
GET /api/users/current
Authorization: Bearer <uuid-token>
```
**Respons Sukses (200):**
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

### Logout Pengguna
```http
DELETE /api/users/logout
Authorization: Bearer <uuid-token>
```
**Respons Sukses (200):**
```json
{
  "data": "OK"
}
```

### Respons Error
Semua endpoint mengembalikan respons error terstruktur:
```json
{
  "error": "Pesan error dalam bahasa Indonesia"
}
```
Kode status umum: `400` (Bad Request), `401` (Unauthorized), `409` (Conflict), `422` (Validation Error)

## 🚀 Menjalankan Aplikasi

### Mode Pengembangan
```bash
bun run dev
```
Memulai server pengembangan dengan hot reload di `http://localhost:3000`

### Mode Produksi
```bash
bun run start
```
Menjalankan aplikasi dalam mode produksi (NODE_ENV=production)

## 🧪 Menguji Aplikasi

Proyek ini menyertakan tes unit komprehensif untuk semua endpoint API.

### Jalankan Tes
```bash
bun test
```
Menjalankan semua tes unit menggunakan test runner bawaan Bun. Tes mencakup:
- 35 skenario tes yang mencakup semua API pengguna
- Pembersihan database antar tes
- Validasi edge case dan penanganan error

### Cakupan Tes
- **POST /api/users** - Registrasi pengguna (10 skenario)
- **POST /api/users/login** - Login pengguna (9 skenario)
- **GET /api/users/current** - Dapatkan pengguna saat ini (8 skenario)
- **DELETE /api/users/logout** - Logout pengguna (8 skenario)

## 🛠️ Script Pengembangan

```bash
bun run dev              # Jalankan server pengembangan
bun run start            # Jalankan server produksi
bun run db:generate      # Generate migrasi database
bun run db:migrate       # Jalankan migrasi database
bun run db:studio        # Buka Drizzle Studio untuk manajemen database
bun test                 # Jalankan tes unit
```

## ?? Fitur Keamanan

- **Hashing Password:** bcrypt dengan 12 ronde
- **Token Sesi:** Berbasis UUID (bukan JWT)
- **Validasi Input:** Validasi schema Elysia
- **Proteksi SQL Injection:** Query terparameterisasi Drizzle ORM
- **Tidak Ada Kebocoran Password:** Password tidak pernah dikembalikan dalam respons

## ?? Ucapan Terima Kasih

- [Bun](https://bun.sh/) - Runtime JavaScript yang cepat
- [Elysia](https://elysiajs.com/) - Framework web elegan
- [Drizzle](https://orm.drizzle.team/) - ORM yang aman tipe
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) - Hashing password

