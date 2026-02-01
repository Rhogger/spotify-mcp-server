import type {
  MaxInt,
  Album,
  SimplifiedTrack,
  SimplifiedAlbum,
} from "@spotify/web-api-ts-sdk";
import { z } from "zod";
import type { tool } from "./types.js";
import { formatDuration, handleSpotifyRequest, authSchema } from "./utils.js";

type WithToken<T> = T & { _accessToken?: string };

// 1. Get Albums
const getAlbums = {
  name: "getAlbums",
  description:
    "Get detailed information about one or more albums by their Spotify IDs",
  schema: {
    albumIds: z
      .union([z.string(), z.array(z.string()).max(20)])
      .describe("A single album ID or array of album IDs (max 20)"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { albumIds, _accessToken } = args;
    const ids = Array.isArray(albumIds) ? albumIds : [albumIds];

    if (ids.length === 0) {
      return {
        content: [{ type: "text", text: "Error: No album IDs provided" }],
      };
    }

    try {
      const albums = await handleSpotifyRequest(
        _accessToken,
        async (spotifyApi) => {
          // A SDK do Spotify trata array e single string de forma inteligente,
          // mas é mais seguro forçar a chamada de lista para garantir retorno de array
          return await spotifyApi.albums.get(ids);
        },
      );

      if (!albums || albums.length === 0) {
        return { content: [{ type: "text", text: "No albums found" }] };
      }

      // Tipagem explícita no map para evitar 'implicit any'
      const formattedAlbums = albums
        .map((album: Album, i: number) => {
          if (!album) return `${i + 1}. [Album not found]`;
          const artists = album.artists.map((a) => a.name).join(", ");
          return `${i + 1}. "${album.name}" by ${artists} (${album.release_date}) - ${album.total_tracks} tracks - ID: ${album.id}`;
        })
        .join("\n");

      return {
        content: [
          { type: "text", text: `# Albums found\n\n${formattedAlbums}` },
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
} satisfies tool<any>;

// 2. Get Album Tracks
const getAlbumTracks = {
  name: "getAlbumTracks",
  description: "Get tracks from a specific album with pagination",
  schema: {
    albumId: z.string().describe("The Spotify ID of the album"),
    limit: z.number().min(1).max(50).optional().describe("Limit (1-50)"),
    offset: z.number().min(0).optional().describe("Offset"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { albumId, limit = 20, offset = 0, _accessToken } = args;

    try {
      const tracks = await handleSpotifyRequest(
        _accessToken,
        async (spotifyApi) => {
          return await spotifyApi.albums.tracks(
            albumId,
            undefined,
            limit as MaxInt<50>,
            offset,
          );
        },
      );

      if (tracks.items.length === 0) {
        return {
          content: [{ type: "text", text: "No tracks found in this album" }],
        };
      }

      const formattedTracks = tracks.items
        .map((track: SimplifiedTrack, i: number) => {
          const artists = track.artists.map((a) => a.name).join(", ");
          const duration = formatDuration(track.duration_ms);
          return `${offset + i + 1}. "${track.name}" by ${artists} (${duration}) - ID: ${track.id}`;
        })
        .join("\n");

      return {
        content: [
          { type: "text", text: `# Album Tracks\n\n${formattedTracks}` },
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
} satisfies tool<any>;

// 3. Save/Remove Albums
const saveOrRemoveAlbumForUser = {
  name: "saveOrRemoveAlbumForUser",
  description: "Save or remove albums from user library",
  schema: {
    albumIds: z
      .array(z.string())
      .max(20)
      .describe("Array of Spotify album IDs (max 20)"),
    action: z.enum(["save", "remove"]).describe("Action: save or remove"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { albumIds, action, _accessToken } = args;

    if (albumIds.length === 0) {
      return {
        content: [{ type: "text", text: "Error: No album IDs provided" }],
      };
    }

    try {
      await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
        return action === "save"
          ? await spotifyApi.currentUser.albums.saveAlbums(albumIds)
          : await spotifyApi.currentUser.albums.removeSavedAlbums(albumIds);
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully ${action}d ${albumIds.length} albums.`,
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
} satisfies tool<any>;

// 4. Check Saved Albums
const checkUsersSavedAlbums = {
  name: "checkUsersSavedAlbums",
  description: "Check if albums are saved in library",
  schema: {
    albumIds: z
      .array(z.string())
      .max(20)
      .describe("Array of Spotify album IDs"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { albumIds, _accessToken } = args;

    try {
      const savedStatus = await handleSpotifyRequest(
        _accessToken,
        async (spotifyApi) => {
          return await spotifyApi.currentUser.albums.hasSavedAlbums(albumIds);
        },
      );

      const formattedResults = albumIds
        .map(
          (id: string, i: number) =>
            `${i + 1}. ${id}: ${savedStatus[i] ? "Saved" : "Not saved"}`,
        )
        .join("\n");

      return {
        content: [
          { type: "text", text: `# Album Save Status\n\n${formattedResults}` },
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
} satisfies tool<any>;

export const albumTools = [
  getAlbums,
  getAlbumTracks,
  saveOrRemoveAlbumForUser,
  checkUsersSavedAlbums,
];
