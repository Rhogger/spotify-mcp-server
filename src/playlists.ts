import type { MaxInt, SimplifiedPlaylist } from "@spotify/web-api-ts-sdk";
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

// --- READ TOOLS ---

const getMyPlaylists = {
  name: "getMyPlaylists",
  description: "Get a list of the current user's playlists on Spotify",
  schema: {
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum number of playlists to return (1-50)"),
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
    const args = rawArgs as WithToken<typeof rawArgs>;
    const {
      limit = 50,
      offset = 0,
      json = false,
      md = true,
      _accessToken,
    } = args;

    const playlists = await handleSpotifyRequest(
      _accessToken,
      async (spotifyApi) => {
        return await spotifyApi.currentUser.playlists.playlists(
          limit as MaxInt<50>,
          offset,
        );
      },
    );

    const content: any[] = [];

    if (md) {
      if (playlists.items.length === 0) {
        content.push({
          type: "text",
          text: "You don't have any playlists on Spotify",
        });
      } else {
        const formattedPlaylists = playlists.items
          .map((playlist: SimplifiedPlaylist, i: number) => {
            const tracksTotal = playlist.tracks?.total
              ? playlist.tracks.total
              : 0;
            return `${offset + i + 1}. "${playlist.name}" (${tracksTotal} tracks) - ID: ${playlist.id}`;
          })
          .join("\n");
        content.push({
          type: "text",
          text: `# Your Spotify Playlists (${offset + 1}-${
            offset + playlists.items.length
          } of ${playlists.total})\n\n${formattedPlaylists}`,
        });
      }
    }

    if (json) {
      content.push({
        type: "text",
        text: JSON.stringify(playlists, null, 2),
      });
    }

    return {
      content,
    };
  },
} satisfies tool<any>;

const getPlaylist = {
  name: "getPlaylist",
  description:
    "Get detailed information about a specific playlist, optionally calculating total duration",
  schema: {
    playlistId: z.string().describe("The Spotify ID of the playlist"),
    calculateTotalDuration: z
      .boolean()
      .optional()
      .describe(
        "Whether to calculate the total duration by fetching all tracks (may be slow for large playlists)",
      ),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { playlistId, calculateTotalDuration = false, _accessToken } = args;

    try {
      const playlist = await handleSpotifyRequest(
        _accessToken,
        async (spotifyApi) => {
          return await spotifyApi.playlists.getPlaylist(playlistId);
        },
      );

      let durationText = "Not calculated";
      let totalDurationMs = 0;

      if (calculateTotalDuration) {
        playlist.tracks.items.forEach((item) => {
          if (item.track && isTrack(item.track)) {
            totalDurationMs += item.track.duration_ms;
          }
        });

        if (playlist.tracks.next) {
          let offset = playlist.tracks.items.length;
          const limit = 50;
          const total = playlist.tracks.total;

          while (offset < total) {
            const response = await handleSpotifyRequest(
              _accessToken,
              async (api) =>
                api.playlists.getPlaylistItems(
                  playlistId,
                  undefined,
                  undefined,
                  limit,
                  offset,
                ),
            );

            response.items.forEach((item) => {
              if (item.track && isTrack(item.track)) {
                totalDurationMs += item.track.duration_ms;
              }
            });

            if (!response.next) break;
            offset += response.items.length;
          }
        }

        const hours = Math.floor(totalDurationMs / 3600000);
        const minutes = Math.floor((totalDurationMs % 3600000) / 60000);
        const seconds = Math.floor((totalDurationMs % 60000) / 1000);

        durationText = `${hours > 0 ? `${hours}h ` : ""}${minutes}m ${seconds}s`;
      }

      const ownerName = playlist.owner?.display_name ?? "Unknown";
      const totalTracks = playlist.tracks.total;
      const description = playlist.description || "No description";
      const followers = playlist.followers?.total || 0;

      const imageUrl = playlist.images?.[0]?.url ?? "No image";

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: playlist.id,
                name: playlist.name,
                description,
                owner: ownerName,
                followers,
                total_tracks: totalTracks,
                total_duration_ms: calculateTotalDuration
                  ? totalDurationMs
                  : null,
                formatted_duration: durationText,
                image: imageUrl,
                privacy: playlist.public ? "Public" : "Private",
                snapshot_id: playlist.snapshot_id,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching playlist details: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  },
} satisfies tool<any>;

// --- WRITE TOOLS ---

const unfollowPlaylist = {
  name: "unfollowPlaylist",
  description:
    "Unfollow (remove) a playlist from the user's library. Note: Spotify API doesn't allow permanent deletion of playlists",
  schema: {
    playlistId: z
      .string()
      .describe("The Spotify ID of the playlist to unfollow"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { playlistId, _accessToken } = args;

    try {
      await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
        await spotifyApi.currentUser.playlists.unfollow(playlistId);
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully unfollowed playlist (ID: ${playlistId}). The playlist has been removed from your library.`,
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
} satisfies tool<any>;

const followPlaylist = {
  name: "followPlaylist",
  description:
    "Follow (save) a playlist to the user's library. This allows the user to access the playlist from their library.",
  schema: {
    playlistId: z
      .string()
      .describe("The Spotify ID of the playlist to follow"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { playlistId, _accessToken } = args;

    try {
      await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
        await spotifyApi.currentUser.playlists.follow(playlistId);
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully followed playlist (ID: ${playlistId}). The playlist has been added to your library.`,
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
} satisfies tool<any>;

const removeTracksFromPlaylist = {
  name: "removeTracksFromPlaylist",
  description: "Remove one or more tracks from a Spotify playlist",
  schema: {
    playlistId: z.string().describe("The Spotify ID of the playlist"),
    trackIds: z
      .array(z.string())
      .describe("Array of Spotify track IDs to remove"),
    positions: z
      .array(z.number())
      .optional()
      .describe(
        "Array of integer positions (0-based) corresponding to each track ID to remove specific instances",
      ),
    snapshotId: z
      .string()
      .optional()
      .describe(
        "The playlist's snapshot ID for concurrency control (optional)",
      ),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { playlistId, trackIds, positions, snapshotId, _accessToken } = args;

    if (trackIds.length === 0) {
      return {
        content: [{ type: "text", text: "Error: No track IDs provided" }],
      };
    }

    try {
      const tracks = trackIds.map((id: string, index: number) => {
        const item: { uri: string; positions?: number[] } = {
          uri: `spotify:track:${id}`,
        };
        if (positions && typeof positions[index] === "number") {
          item.positions = [positions[index]];
        }
        return item;
      });

      await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
        await spotifyApi.playlists.removeItemsFromPlaylist(playlistId, {
          tracks,
          snapshot_id: snapshotId,
        });
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully removed ${trackIds.length} track(s) from playlist (ID: ${playlistId})`,
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
} satisfies tool<any>;

const updatePlaylistDetails = {
  name: "updatePlaylistDetails",
  description:
    "Update a playlist's name, description, or public/private status",
  schema: {
    playlistId: z.string().describe("The Spotify ID of the playlist to update"),
    name: z.string().optional().describe("New name for the playlist"),
    description: z
      .string()
      .optional()
      .describe("New description for the playlist"),
    public: z.boolean().optional().describe("Whether the playlist is public"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const {
      playlistId,
      name,
      description,
      public: isPublic,
      _accessToken,
    } = args;

    if (!name && description === undefined && isPublic === undefined) {
      return {
        content: [
          {
            type: "text",
            text: "Error: At least one field (name, description, or public) must be provided",
          },
        ],
      };
    }

    try {
      await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
        await spotifyApi.playlists.changePlaylistDetails(playlistId, {
          name,
          description,
          public: isPublic,
        });
      });

      const updatedFields = [];
      if (name) updatedFields.push(`name: "${name}"`);
      if (description !== undefined) updatedFields.push("description");
      if (isPublic !== undefined)
        updatedFields.push(`visibility: ${isPublic ? "public" : "private"}`);

      return {
        content: [
          {
            type: "text",
            text: `Successfully updated playlist (ID: ${playlistId}). Updated: ${updatedFields.join(", ")}`,
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
} satisfies tool<any>;

const reorderPlaylistTracks = {
  name: "reorderPlaylistTracks",
  description: "Reorder tracks in a playlist by moving them to a new position",
  schema: {
    playlistId: z.string().describe("The Spotify ID of the playlist"),
    rangeStart: z
      .number()
      .min(0)
      .describe("The position of the first track to be reordered"),
    insertBefore: z
      .number()
      .min(0)
      .describe("The position where the tracks should be inserted"),
    rangeLength: z
      .number()
      .min(1)
      .optional()
      .describe("The number of tracks to be reordered (default: 1)"),
    snapshotId: z
      .string()
      .optional()
      .describe("The playlist's snapshot ID for concurrency control"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const {
      playlistId,
      rangeStart,
      insertBefore,
      rangeLength = 1,
      snapshotId,
      _accessToken,
    } = args;

    try {
      const result = await handleSpotifyRequest(
        _accessToken,
        async (spotifyApi) => {
          return await spotifyApi.playlists.updatePlaylistItems(playlistId, {
            range_start: rangeStart,
            insert_before: insertBefore,
            range_length: rangeLength,
            snapshot_id: snapshotId,
          });
        },
      );

      return {
        content: [
          {
            type: "text",
            text: `Successfully reordered ${rangeLength} track(s) in playlist (ID: ${playlistId}). New snapshot: ${result.snapshot_id}`,
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
} satisfies tool<any>;

const createPlaylist = {
  name: "createPlaylist",
  description: "Create a new playlist on Spotify",
  schema: {
    name: z.string().describe("The name of the playlist"),
    description: z
      .string()
      .optional()
      .describe("The description of the playlist"),
    public: z
      .boolean()
      .optional()
      .describe("Whether the playlist should be public"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { name, description, public: isPublic = false, _accessToken } = args;

    const result = await handleSpotifyRequest(
      _accessToken,
      async (spotifyApi) => {
        const me = await spotifyApi.currentUser.profile();
        return await spotifyApi.playlists.createPlaylist(me.id, {
          name,
          description,
          public: isPublic,
        });
      },
    );

    return {
      content: [
        {
          type: "text",
          text: `Successfully created playlist "${name}"\nPlaylist ID: ${result.id}\nPlaylist URL: ${result.external_urls.spotify}`,
        },
      ],
    };
  },
} satisfies tool<any>;

const addTracksToPlaylist = {
  name: "addTracksToPlaylist",
  description: "Add tracks to a Spotify playlist",
  schema: {
    playlistId: z.string().describe("The Spotify ID of the playlist"),
    trackIds: z.array(z.string()).describe("Array of Spotify track IDs to add"),
    position: z
      .number()
      .nonnegative()
      .optional()
      .describe("Position to insert the tracks"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { playlistId, trackIds, position, _accessToken } = args;

    if (trackIds.length === 0) {
      return {
        content: [{ type: "text", text: "Error: No track IDs provided" }],
      };
    }

    try {
      const resultMsg = await handleSpotifyRequest(
        _accessToken,
        async (spotifyApi) => {
          // 1. Fetch existing tracks (limit 1000)
          const existingTrackIds = new Set<string>();
          let offset = 0;
          const limit = 50;
          let hasNext = true;

          // Fetch only IDs to be faster
          while (hasNext && offset < 1000) {
            const response = await spotifyApi.playlists.getPlaylistItems(
              playlistId,
              undefined,
              "items(track(id)),next",
              limit,
              offset,
            );
            response.items.forEach((item: any) => {
              if (item.track && item.track.id) {
                existingTrackIds.add(item.track.id);
              }
            });
            if (!response.next) hasNext = false;
            offset += limit;
          }

          // 2. Filter new tracks
          const newTrackIds = trackIds.filter((id: string) => !existingTrackIds.has(id));

          if (newTrackIds.length === 0) {
            return "All provided tracks are already in the playlist.";
          }

          // 3. Add new tracks
          const trackUris = newTrackIds.map((id: string) => `spotify:track:${id}`);
          await spotifyApi.playlists.addItemsToPlaylist(
            playlistId,
            trackUris,
            position,
          );

          const skipped = trackIds.length - newTrackIds.length;
          return `Successfully added ${newTrackIds.length} tracks to playlist (ID: ${playlistId}).${skipped > 0 ? ` Skipped ${skipped} duplicate(s).` : ""}`;
        },
      );

      return {
        content: [
          {
            type: "text",
            text: resultMsg,
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
} satisfies tool<any>;

const replacePlaylistTracks = {
  name: "replacePlaylistTracks",
  description:
    "Replace all tracks in a playlist with new ones (clears existing tracks)",
  schema: {
    playlistId: z.string().describe("The Spotify ID of the playlist"),
    trackIds: z
      .array(z.string())
      .describe("Array of Spotify track IDs to set as the playlist content"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { playlistId, trackIds, _accessToken } = args;

    try {
      const trackUris = trackIds.map((id: string) => `spotify:track:${id}`);

      await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
        await spotifyApi.playlists.updatePlaylistItems(playlistId, {
          uris: trackUris,
        });
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully replaced all tracks in playlist (ID: ${playlistId}) with ${trackIds.length} new track(s)`,
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
} satisfies tool<any>;

export const playlistTools = [
  getMyPlaylists,
  getPlaylist,
  createPlaylist,
  followPlaylist,
  unfollowPlaylist,
  addTracksToPlaylist,
  removeTracksFromPlaylist,
  updatePlaylistDetails,
  reorderPlaylistTracks,
  replacePlaylistTracks,
];
