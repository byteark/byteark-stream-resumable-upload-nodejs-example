# ByteArk Stream Resumable Upload with NodeJS

This example provides an example of uploading videos from your server,
using NodeJS in TypeScript.

## Installation

1. Install dependencies

```bash
npm install
```

2. Copy and edit `.env` file

```bash
cp .env.example .env
```

## Running the sample code

The sample code will upload a video, and print the video key.
You may store this video key in your database, and use them to construct
the m3u8 URL for playback.

```bash
npm run start
```

Expected output:

```
Uploading video from ./resources/drone-view-by-sascha-weber.mp4
Uploaded video key: Us9cIcVMHB9U
```

## Using this in your project

We already separate the code that can be copy/paste directly, and the code
that required you to edit, so to include them in your project:

1. Copy the code in `src/byteark-stream` to your project.
2. Install some dependencies:

```bash
npm install --save axios mime-type tus-js-client @sinclair/typebox
```

3. Using `StreamService` class just like the sample code in `src/index.ts`.
