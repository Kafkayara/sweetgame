This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Audio effects

Efek swap, match/pop, ledakan, dan kemenangan dibuat langsung dengan Web Audio API, tanpa file MP3. Suara aktif setelah interaksi pertama pada papan. Tombol speaker mengaktifkan atau mematikan suara; combo bertingkat menaikkan nada pop.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Pengembangan bertahap

Tahap 1 menambahkan empat level berurutan dengan target skor dan jatah langkah yang berbeda, progress bar, dialog menang/kalah, serta swipe pada layar sentuh. Mode Tanpa Batas tidak mengurangi langkah. Tombol restart dan pergantian mode dikunci selama swap/cascade. Bentuk enam warna permen dibedakan agar papan lebih mudah dibaca.

Struktur kode:
- `app/page.tsx`: papan 8x8, deteksi match, pembentukan dan kombinasi permen spesial, cascade, hint, level, dan tampilan permainan.
- `app/globals.css`: tampilan permen, partikel, animasi, dan indikator level.
- `app/use-game-audio.ts`: efek suara sintetis dan mute.

Progres level saat ini berlaku selama sesi bermain dan kembali ke level 1 setelah reload.

Tahap berikut yang disarankan:
1. Pisahkan engine match-3 dari komponen UI dan tambahkan pengujian deterministik untuk match, combo, dan special candy.
2. Tambahkan objektif jelly dan penghalang, kemudian sesuaikan desain serta kesulitan tiap level.
3. Tambahkan peta level, bintang, dan penyimpanan progres lokal.
4. Perhalus animasi pertukaran/jatuh dan lengkapi aset suara.

Validasi: `npx.cmd tsc --noEmit` dan `npm.cmd run build`. Build memerlukan akses Google Fonts karena konfigurasi font bawaan proyek.
