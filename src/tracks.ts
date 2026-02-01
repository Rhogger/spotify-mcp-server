import type { MaxInt, PlaylistedTrack, Track } from "@spotify/web-api-ts-sdk";
import { z } from "zod";
import type { SpotifyTrack, tool } from "./types.js";
import { formatDuration, handleSpotifyRequest, authSchema, formatError } from "./utils.js";

type WithToken<T> = T & { _accessToken?: string };

function isTrack(item: any): item is SpotifyTrack {
  return (
    item &&
    item.type === "track" &&
    Array.isArray(item.artists) &&
    item.album &&
    typeof item.album.name === "string"
  );
}

const getTrackImagesShape = {
  trackIds: z
    .array(z.string())
    .describe("List of Spotify track IDs to fetch cover URLs for"),
  ...authSchema,
};

const getTrackImages = {
  name: "getTrackImages",
  description: "Get album cover images for a batch of track IDs",
  schema: getTrackImagesShape,
  handler: async (args, _extra) => {
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
            text: formatError(error),
          },
        ],
      };
    }
  },
} satisfies tool<typeof getTrackImagesShape>;

const getPlaylistTracks = {
  name: "getPlaylistTracks",
  description: "Get a list of tracks in a Spotify playlist",
  schema: {
    playlistId: z.string().describe("The Spotify ID of the playlist"),
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum number of tracks to return (1-50)"),
    offset: z
      .number()
      .min(0)
      .optional()
      .describe("Offset for pagination (0-based index)"),
    json: z.boolean().optional().describe("Return JSON data"),
    md: z.boolean().optional().describe("Return Markdown format"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    try {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const {
      playlistId,
      limit = 50,
      offset = 0,
      json = false,
      md = true,
      _accessToken,
    } = args;

    const playlistTracks = await handleSpotifyRequest(
      _accessToken,
      async (spotifyApi) => {
        return await spotifyApi.playlists.getPlaylistItems(
          playlistId,
          undefined,
          undefined,
          limit as MaxInt<50>,
          offset,
        );
      },
    );

    const content: any[] = [];

    if (md) {
      if ((playlistTracks.items?.length ?? 0) === 0) {
        content.push({
          type: "text",
          text: "This playlist doesn't have any tracks",
        });
      } else {
        const formattedTracks = playlistTracks.items
          .map((item: PlaylistedTrack, i: number) => {
            const { track } = item;
            if (!track) return `${offset + i + 1}. [Removed track]`;

            if (isTrack(track)) {
              const artists = track.artists.map((a) => a.name).join(", ");
              const duration = formatDuration(track.duration_ms);
              return `${offset + i + 1}. "${track.name}" by ${artists} (${duration}) - ID: ${track.id}`;
            }

            return `${offset + i + 1}. Unknown item`;
          })
          .join("\n");

        content.push({
          type: "text",
          text: `# Tracks in Playlist (${offset + 1}-${
            offset + playlistTracks.items.length
          } of ${playlistTracks.total})\n\n${formattedTracks}`,
        });
      }
    }

    if (json) {
      content.push({
        type: "text",
        text: JSON.stringify(playlistTracks, null, 2),
      });
    }

    return {
      content,
    };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: formatError(error),
          },
        ],
      };
    }
  },
} satisfies tool<any>;

export const trackTools = [getTrackImages, getPlaylistTracks];

