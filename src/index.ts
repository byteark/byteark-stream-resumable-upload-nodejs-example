import "dotenv/config";
import { ByteArkStreamService } from "./byteark-stream";

async function main() {
  if (!process.env.BYTEARK_STREAM_ACCESS_TOKEN) {
    throw new Error("BYTEARK_STREAM_ACCESS_TOKEN is not set");
  }
  if (!process.env.BYTEARK_STREAM_DEFAULT_PROJECT_KEY) {
    throw new Error("BYTEARK_STREAM_DEFAULT_PROJECT_KEY is not set");
  }

  const streamService = new ByteArkStreamService({
    accessToken: process.env.BYTEARK_STREAM_ACCESS_TOKEN,
    defaultProjectKey: process.env.BYTEARK_STREAM_DEFAULT_PROJECT_KEY,
  });

  // Uploading a video here
  const videoFilePath = "./resources/drone-view-by-sascha-weber.mp4";
  const videoTitle = "Sample video";

  console.log(`Uploading video from ${videoFilePath}`);
  const videoKey = await streamService.createAndUploadVideo({
    localFilePath: videoFilePath,
    title: videoTitle,
  });

  console.log(`Uploaded video key: ${videoKey}`);
}

main();
