# Kasir AI

Sistem Point of Sale (POS) berbasis Next.js dengan fitur:
- Manajemen produk dan kategori
- Keranjang dan checkout transaksi
- Smart search produk berbasis AI
- AI Assistant (chat streaming + tool calling)
- AI Analytics untuk analisis penjualan berbasis bahasa natural

## Tech Stack

- `Next.js 16` (App Router)
- `React 19` + TypeScript
- `Prisma ORM`
- `PostgreSQL`
- `LangChain` + `Google Gemini`
- UI components: `shadcn/ui`, `Tailwind CSS`

## Halaman Utama

- `/kasir` -> UI POS utama (produk, keranjang, AI assistant)
- `/analytics` -> dashboard analytics + AI analyst

## Prasyarat

- Node.js 20+
- PostgreSQL aktif
- API key Google Gemini

## Environment Variables

Buat file `.env.local` (atau `.env`) dengan isi minimal:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/kasir_ai?schema=public"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

Catatan:
- Prisma config berada di `prisma.config.ts`, jadi perintah Prisma membaca `DATABASE_URL` dari environment.
- Pastikan user PostgreSQL punya privilege `USAGE` dan `CREATE` pada schema `public`.

## Instalasi

```bash
npm install
```

## Setup Database

Generate Prisma client:

```bash
npm run db:generate
```

Push schema ke database:

```bash
npm run db:push
```

Seed data awal:

```bash
npm run db:seed
```

Jika ingin reset total:

```bash
npm run db:reset
```

## Menjalankan Project

Development:

```bash
npm run dev
```

Akses aplikasi:
- `http://localhost:3000/kasir`
- `http://localhost:3000/analytics`

## Scripts

- `npm run dev` -> jalankan Next.js dev server
- `npm run build` -> build production
- `npm run start` -> jalankan server production
- `npm run lint` -> lint project
- `npm run db:generate` -> generate Prisma client
- `npm run db:push` -> sinkronkan schema Prisma ke DB
- `npm run db:seed` -> isi data awal
- `npm run db:studio` -> buka Prisma Studio
- `npm run db:reset` -> reset schema + seed ulang

## API Endpoints

- `GET /api/health` -> cek koneksi DB + jumlah data utama
- `GET /api/products` -> ambil daftar produk
- `POST /api/search` -> pencarian produk berbasis AI parser
- `POST /api/chat` -> AI assistant streaming (SSE)
- `GET|POST /api/transactions` -> list transaksi / create transaksi
- `POST /api/analytics` -> analisis penjualan dengan AI
- `GET /api/analytics/quick` -> quick stats ringkas
- `GET /api/test-ai` -> test koneksi model AI

## Struktur Direktori Ringkas

```txt
src/
  app/
    kasir/page.tsx
    analytics/page.tsx
    api/
  components/
    pos/
    analytics/
    ui/
  lib/
    ai/
    db.ts
prisma/
  schema.prisma
  seed.ts
```

## Troubleshooting Singkat

1. Error `permission denied for schema public` saat `prisma db push`:
   - Grant privilege schema ke user app di PostgreSQL:
   - `GRANT USAGE, CREATE ON SCHEMA public TO <db_user>;`

2. AI endpoint gagal:
   - Cek `GEMINI_API_KEY` sudah terisi valid.
   - Coba endpoint `GET /api/test-ai`.
