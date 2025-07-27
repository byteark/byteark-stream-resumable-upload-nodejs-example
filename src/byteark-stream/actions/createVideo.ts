import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { AssertError, Value } from "@sinclair/typebox/value";

const createVideoRequestSchema = Type.Object(
  {
    projectKey: Type.String(),
    presetId: Type.Optional(Type.String()),
    videos: Type.Array(
      Type.Object({
        title: Type.String(),
        tags: Type.Optional(Type.Union([Type.Array(Type.String()), Type.Null(), Type.Undefined()])),
      }),
    ),
  },
  {
    additionalProperties: false,
  },
);

const createVideoResponseSchema = Type.Array(
  Type.Object({
    key: Type.String(),
  }),
);

export type CreateVideoRequest = Static<typeof createVideoRequestSchema>;

export type CreateVideoResponse = Static<typeof createVideoResponseSchema>;

export function castCreateVideoRequest(request: CreateVideoRequest): CreateVideoRequest {
  try {
    return Value.Parse(createVideoRequestSchema, request);
  } catch (error) {
    if (error instanceof AssertError) {
      throw new Error(`Unexpected request body; ${error.message}; objectPath=${error.error?.path}`);
    }
    throw error;
  }
}

export function parseCreateVideoResponse(responseBody: unknown): CreateVideoResponse {
  try {
    return Value.Parse(createVideoResponseSchema, responseBody);
  } catch (error) {
    if (error instanceof AssertError) {
      throw new Error(`Unexpected response body; ${error.message}; objectPath=${error.error?.path}`);
    }
    throw error;
  }
}
