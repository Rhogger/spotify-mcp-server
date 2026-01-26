import type { Track } from "@spotify/web-api-ts-sdk";
import { z } from "zod";
import type { tool } from "./types.js";
import { handleSpotifyRequest, authSchema } from "./utils.js";

// Define o Shape (Objeto literal), não o z.object()
const getTrackImagesShape = {
  trackIds: z
    .array(z.string())
    .describe("List of Spotify track IDs to fetch cover URLs for"),
  ...authSchema, // <--- Adiciona o token explicitamente
};

const getTrackImages = {
  name: "getTrackImages",
  description: "Get album cover images for a batch of track IDs",
  schema: getTrackImagesShape,
  handler: async (args, _extra) => {
    // O args já vem tipado corretamente graças à mudança no types.ts
    const { trackIds, _accessToken } = args;

    if (!trackIds || trackIds.length === 0) {
      return {
        content: [{ type: "text", text: "Error: No track IDs provided" }],
      };
    }

    try {
      const result = await handleSpotifyRequest(
        _accessToken,
        async (spotify) => {
          const CHUNK_SIZE = 50;
          const results: Record<string, string | null> = {};
          const chunks: string[][] = [];

          for (let i = 0; i < trackIds.length; i += CHUNK_SIZE) {
            chunks.push(trackIds.slice(i, i + CHUNK_SIZE));
          }

          for (const chunk of chunks) {
            try {
              const tracks = await spotify.tracks.get(chunk);
              tracks.forEach((track: Track) => {
                if (track?.album?.images?.length > 0) {
                  results[track.id] = track.album.images[0].url;
                } else {
                  results[track.id] = null;
                }
              });
            } catch (error) {
              console.error(`Error fetching track chunk:`, error);
              chunk.forEach((id) => (results[id] = null));
            }
          }

          return {
            images: results,
            count: Object.keys(results).length,
          };
        },
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
} satisfies tool<typeof getTrackImagesShape>;

export const trackTools = [getTrackImages];
