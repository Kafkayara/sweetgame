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
- `app/page.tsx`: tampilan papan 8x8, input pemain, suara, dan partikel.
- `app/game/engine.ts`: aturan match, permen spesial, gravitasi, refill, dan pencarian langkah.
- `app/game/reducer.ts`: satu state gameplay (papan, skor, langkah, pilihan, hint, level, mode, dan fase animasi) beserta transisi kaskade.
- `app/game/use-game-controller.ts`: lifecycle permainan dan hint; merencanakan langkah berikutnya hanya setelah tahap sebelumnya selesai.
- `app/game/use-game-animations.ts`: animasi dari layout yang sudah di-commit React, dipisahkan dari animasi visual tombol.
- `app/game/motion.ts`: perhitungan gerak berdasarkan ID permen dan pembatas tahap `Animation.finished` + `requestAnimationFrame`.
- `tests/`: pengujian deterministik untuk reducer, kaskade, gravitasi, serta pembatalan animasi.
- `app/globals.css`: tampilan permen, partikel, animasi, dan indikator level.
- `app/use-game-audio.ts`: efek suara sintetis dan mute.

Progres level saat ini berlaku selama sesi bermain dan kembali ke level 1 setelah reload.

Tahap berikut yang disarankan:
1. Tambahkan objektif jelly dan penghalang, kemudian sesuaikan desain serta kesulitan tiap level.
2. Tambahkan peta level, bintang, dan penyimpanan progres lokal.
3. Tambahkan variasi efek dan penyetelan animasi untuk perangkat seluler.

Validasi: `npm.cmd test` (Node.js 24), `npx.cmd tsc --noEmit`, dan `npm.cmd run build`. Build memerlukan akses Google Fonts karena konfigurasi font bawaan proyek.


## State dan sinkronisasi animasi

Fase permainan: `idle ? swapping ? popping ? falling`, lalu kembali ke `popping` jika ada match lanjutan. Swap tidak valid masuk ke `reverting`; papan buntu masuk ke `shuffling`. `won`/`lost` hanya ditentukan setelah seluruh kaskade selesai.

Reducer memproses input secara atomik dan menolak swap saat sibuk. Setiap reset menaikkan `session`, dan setiap tahap menaikkan `revision`. Hasil animasi, perencanaan transisi, dan hint membawa token keduanya, sehingga callback lama tidak bisa mengubah permainan atau tahap baru. Reducer tidak menghasilkan angka acak atau ID; papan dan refill disiapkan di luar reducer agar aman saat React mengulang pemanggilan reducer.

`useLayoutEffect` membaca seluruh posisi sebelum animasi dimulai, lalu Web Animations API menggerakkan wrapper dengan `translate3d` dan `opacity`. ID permen bertahan saat jatuh lintas baris, dan permen baru masuk dari posisi bertumpuk di atas kolomnya. Hover, glow pilihan, dan pop memakai elemen tombol di dalam wrapper agar tidak berebut transform dengan gravitasi. Tidak ada pembaruan state React setiap frame atau jeda `setTimeout` untuk mengendalikan kaskade.

Tahap berikutnya menunggu semua `Animation.finished` dan satu `requestAnimationFrame`. Cleanup membatalkan animasi dan frame yang tertunda saat restart, unmount, atau pengulangan efek oleh React Strict Mode. Mode reduced motion tetap melewati pembatas render yang sama, tanpa menjalankan animasi.

Animasi mengikuti refresh browser dan dirancang untuk target 60 FPS; frame rate nyata tetap bergantung pada perangkat dan beban browser, sehingga harus diprofilkan pada perangkat sasaran.
