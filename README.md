# File Size Controller

A React + Vite local-first file utility with a Capacitor Android wrapper.

## Features

- Image compression in the browser using Canvas (`WebP`, `JPEG`, or `PNG` output).
- GZIP compression for other file types. The result is a `.gz` archive, not the original format rewritten in place.
- Exact-size padded binary copy by appending zero bytes. The output is `.padded.bin`; it is not guaranteed to remain a valid file of the original type.
- Local processing; no application server or file upload endpoint.
- Web download and Android native share/save flow.
- 100 MB maximum added padding in this starter to reduce memory pressure.

## Requirements

- Node.js 20 or newer
- npm
- For Android: Android Studio and an installed Android SDK

## Run on the web

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build for web

```bash
npm run build
npm run preview
```

Deploy the generated `dist/` directory to a static hosting provider. No backend is required.

## Build the Android app

First install dependencies and build the web app:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, wait for Gradle sync, then run on a device or build an APK using **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

For later code changes:

```bash
npm run android:sync
npx cap open android
```

Change `appId` in `capacitor.config.ts` before publishing, replacing `com.example.filesizecontroller` with your own unique application ID.

## Important format limitations

- Image compression decodes and re-encodes raster images. It may reduce quality, remove metadata, and change the format. SVG is not handled by the image path.
- PNG output uses the browser's PNG encoder; the quality slider does not apply to PNG.
- Non-image compression uses GZIP. It creates a `.gz` file. Files already compressed (JPEG, MP4, ZIP, many PDFs) may not shrink.
- Size increase appends zero bytes and exports a `.padded.bin` file. It does not create a valid larger image, PDF, MP4, or ZIP in a format-aware way. Do not rename it to the original extension and assume it will work.
- Very large files can exceed available browser/device memory. The 100 MB cap applies to added padding, not to source-file size or GZIP processing.
- For production, add a Web Worker, streaming output, cancellation, stronger file-size limits, and device testing for large files. Avoid loading very large outputs into base64 for Android sharing.

## Privacy

This project contains no upload API. Processing is performed by the browser/WebView. The Google Fonts import in `src/style.css` is an external font request; remove the `@import` line if you want the UI to make no external network requests at all.
