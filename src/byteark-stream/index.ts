import type { AxiosInstance } from "axios";
import axios from "axios";
import mime from "mime-types";
import fs from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { DetailedError, Upload } from "tus-js-client";
import { castCreateVideoRequest, parseCreateVideoResponse } from "./actions/createVideo";

/**
 * The options for the StreamService.
 */
export type ByteArkStreamServiceOptions = {
  /**
   * The access token for the ByteArk Stream API.
   * @see https://docs.byteark.com/docs/stream/api-reference/authentication
   */
  accessToken: string;

  /**
   * The default project key for the ByteArk Stream API.
   * @see https://docs.byteark.com/th/stream/project-management-overview.html
   */
  defaultProjectKey: string;

  /**
   * The default preset ID for the ByteArk Stream API.
   * By default, it will use the default preset of the project.
   */
  defaultPresetId?: string;

  /**
   * The chunk size for the video upload.
   * By default, it will be 100MB.
   */
  uploadVideoChunkSize?: number;
};

/**
 * The parameters for creating and uploading a video.
 */
export type ByteArkStreamCreateVideoParams = {
  /**
   * The local file path of the video to upload.
   */
  localFilePath: string;

  /**
   * The title of the video.
   * By default, it will be the file name of the video.
   */
  title?: string;

  /**
   * The tags of the video.
   */
  tags?: string[];

  /**
   * The project key of the video.
   * By default, it will use the default project key set in the service.
   */
  projectKey?: string;

  /**
   * The preset ID of the video.
   * By default, it will use the default preset ID set in the service.
   */
  presetId?: string;
};

export class ByteArkStreamService {
  private readonly accessToken: string;

  private readonly defaultProjectKey: string;

  private readonly defaultPresetId?: string;

  private readonly axiosClient: AxiosInstance;

  private readonly defaultApiRequestTimeout = 10000;

  private readonly uploadRetryDelays = [0, 5000, 5000, 10000, 10000, 15000, 15000, 20000, 20000, 30000, 30000];

  private readonly uploadVideoChunkSize = 1024 * 1024 * 100;

  constructor(options: ByteArkStreamServiceOptions) {
    if (!options.accessToken) {
      throw new Error("accessToken is required");
    }
    if (!options.defaultProjectKey) {
      throw new Error("defaultProjectKey is required");
    }

    this.accessToken = options.accessToken;
    this.defaultProjectKey = options.defaultProjectKey;
    this.defaultPresetId = options.defaultPresetId;
    this.uploadVideoChunkSize = options.uploadVideoChunkSize ?? this.uploadVideoChunkSize;

    this.axiosClient = axios.create({
      baseURL: "https://stream.byteark.com",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      timeout: this.defaultApiRequestTimeout,
    });
  }

  /**
   * Create a video and upload it to ByteArk Stream.
   *
   * @param params - The parameters for creating and uploading the video.
   * @returns The video key of the created video.
   */
  async createAndUploadVideo(params: ByteArkStreamCreateVideoParams): Promise<string> {
    let fileHandler: fs.FileHandle | null = null;
    try {
      fileHandler = await fs.open(params.localFilePath, "r");

      const { fileName, fileType, fileSize } = await this.getFileInfo({
        fileHandler,
        localFilePath: params.localFilePath,
      });
      const videoTitle = params.title ?? fileName;
      const videoKey = await this.createVideo({
        title: videoTitle,
        tags: params.tags,
        projectKey: params.projectKey ?? this.defaultProjectKey,
        presetId: params.presetId ?? this.defaultPresetId,
      });

      const fileReadStream = fileHandler.createReadStream();
      await this.uploadVideo({
        videoKey,
        fileName,
        fileType,
        fileSize,
        fileReadStream,
      });
      return videoKey;
    } finally {
      if (fileHandler) {
        await fileHandler.close();
      }
    }
  }

  private async getFileInfo(params: { fileHandler: fs.FileHandle; localFilePath: string }): Promise<{
    fileName: string;
    fileType: string;
    fileSize: number;
  }> {
    const { fileHandler, localFilePath } = params;
    const guessedfileType = mime.lookup(localFilePath);

    const fileType = guessedfileType !== false ? guessedfileType : "application/octet-stream";
    const fileStat = await fileHandler.stat();
    const fileName = path.basename(localFilePath);
    const fileSize = fileStat.size;

    return {
      fileName,
      fileType,
      fileSize,
    };
  }

  private async createVideo(params: {
    title: string;
    tags?: string[];
    projectKey?: string;
    presetId?: string;
  }): Promise<string> {
    const requestBody = castCreateVideoRequest({
      projectKey: params.projectKey ?? this.defaultProjectKey,
      presetId: params.presetId ?? this.defaultPresetId,
      videos: [
        {
          title: params.title,
          tags: params.tags,
        },
      ],
    });

    const response = await this.axiosClient.post("https://stream.byteark.com/api/v1/videos", requestBody, {
      headers: {
        "Content-Type": "application/json",
        Authroization: `Bearer ${this.accessToken}`,
      },
    });

    const responseBody = parseCreateVideoResponse(response.data);

    return responseBody[0].key;
  }

  private async uploadVideo(params: {
    videoKey: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileReadStream: Readable;
  }) {
    const { videoKey, fileName, fileType, fileSize, fileReadStream } = params;

    return new Promise((resolve, reject) => {
      const uploadJob = new Upload(fileReadStream, {
        storeFingerprintForResuming: false,
        endpoint: "https://stream.byteark.com/api/upload/v1/tus/videos",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        metadata: {
          videoKey: videoKey,
          filename: fileName,
          filetype: fileType,
        },
        uploadSize: fileSize,
        chunkSize: this.uploadVideoChunkSize,
        retryDelays: this.uploadRetryDelays,
        onShouldRetry: (error) => this.onShouldRetry(error),
        onError: (error) => {
          reject(error);
        },
        onSuccess: () => {
          resolve(true);
        },
      });
      uploadJob.start();
    });
  }

  private onShouldRetry(error: Error | DetailedError): boolean {
    if (error instanceof DetailedError) {
      const responseStatus = error.originalResponse ? error.originalResponse.getStatus() : 0;

      // TUS will automatically retry terminating upload if the responseStatus is 423
      if (responseStatus !== 423) {
        console.error("Error when uploading", error);
      }

      if (responseStatus === 403) {
        return false;
      }

      /**
       * This error will be thrown after aborting and terminating upload.
       * Allow TUS to retry until the server returns 204 No Content.
       */
      if (responseStatus === 423) {
        return true;
      }
    }

    console.error("Error when uploading", error);
    return true;
  }
}
