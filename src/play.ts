import { z } from "zod";
import type { tool } from "./types.js";
import { handleSpotifyRequest, authSchema, formatError } from "./utils.js";

// Helper para injetar o token no tipo inferido pelo Zod
type WithToken<T> = T & { _accessToken?: string };

// --- TOOLS ---

const playMusic = {
  name: "playMusic",
  description: "Start playing a Spotify track, album, artist, or playlist",
  schema: {
    uri: z
      .string()
      .optional()
      .describe("The Spotify URI to play (overrides type and id)"),
    type: z
      .enum(["track", "album", "artist", "playlist"])
      .optional()
      .describe("The type of item to play"),
    id: z.string().optional().describe("The Spotify ID of the item to play"),
    deviceId: z
      .string()
      .optional()
      .describe("The Spotify device ID to play on"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { uri, type, id, deviceId, _accessToken } = args;

    if (!(uri || (type && id))) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Must provide either a URI or both a type and ID",
          },
        ],
        isError: true,
      };
    }

    let spotifyUri = uri;
    if (!spotifyUri && type && id) {
      spotifyUri = `spotify:${type}:${id}`;
    }

    await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
      const device = deviceId || "";
      if (!spotifyUri) {
        await spotifyApi.player.startResumePlayback(device);
        return;
      }
      if (type === "track") {
        await spotifyApi.player.startResumePlayback(device, undefined, [
          spotifyUri,
        ]);
      } else {
        await spotifyApi.player.startResumePlayback(device, spotifyUri);
      }
    });

    return {
      content: [
        {
          type: "text",
          text: `Started playing ${type || "music"} ${id ? `(ID: ${id})` : ""}`,
        },
      ],
    };
  },
} satisfies tool<any>;

const pausePlayback = {
  name: "pausePlayback",
  description: "Pause Spotify playback on the active device",
  schema: {
    deviceId: z
      .string()
      .optional()
      .describe("The Spotify device ID to pause playback on"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    await handleSpotifyRequest(args._accessToken, async (spotifyApi) => {
      await spotifyApi.player.pausePlayback(args.deviceId || "");
    });
    return { content: [{ type: "text", text: "Playback paused" }] };
  },
} satisfies tool<any>;

const skipToNext = {
  name: "skipToNext",
  description: "Skip to the next track",
  schema: {
    deviceId: z
      .string()
      .optional()
      .describe("The Spotify device ID to skip on"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    await handleSpotifyRequest(args._accessToken, async (spotifyApi) => {
      await spotifyApi.player.skipToNext(args.deviceId || "");
    });
    return { content: [{ type: "text", text: "Skipped to next track" }] };
  },
} satisfies tool<any>;

const skipToPrevious = {
  name: "skipToPrevious",
  description: "Skip to the previous track",
  schema: {
    deviceId: z
      .string()
      .optional()
      .describe("The Spotify device ID to skip on"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    await handleSpotifyRequest(args._accessToken, async (spotifyApi) => {
      await spotifyApi.player.skipToPrevious(args.deviceId || "");
    });
    return { content: [{ type: "text", text: "Skipped to previous track" }] };
  },
} satisfies tool<any>;

// 7. Resume
const resumePlayback = {
  name: "resumePlayback",
  description: "Resume Spotify playback",
  schema: {
    deviceId: z.string().optional().describe("Device ID"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    await handleSpotifyRequest(args._accessToken, async (spotifyApi) => {
      await spotifyApi.player.startResumePlayback(args.deviceId || "");
    });
    return { content: [{ type: "text", text: "Playback resumed" }] };
  },
} satisfies tool<any>;

// 8. Add to Queue
const addToQueue = {
  name: "addToQueue",
  description: "Add item to queue",
  schema: {
    uri: z.string().optional(),
    type: z.enum(["track", "album", "artist", "playlist"]).optional(),
    id: z.string().optional(),
    deviceId: z.string().optional(),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { uri, type, id, deviceId, _accessToken } = args;

    let spotifyUri = uri;
    if (!spotifyUri && type && id) {
      spotifyUri = `spotify:${type}:${id}`;
    }

    if (!spotifyUri) {
      return {
        content: [{ type: "text", text: "Error: Must provide URI or type+ID" }],
      };
    }

    await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
      await spotifyApi.player.addItemToPlaybackQueue(
        spotifyUri!,
        deviceId || "",
      );
    });

    return {
      content: [{ type: "text", text: `Added ${spotifyUri} to queue` }],
    };
  },
} satisfies tool<any>;

// 9. Set Volume
const setVolume = {
  name: "setVolume",
  description: "Set volume (0-100)",
  schema: {
    volumePercent: z.number().min(0).max(100),
    deviceId: z.string().optional(),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    try {
      await handleSpotifyRequest(args._accessToken, async (spotifyApi) => {
        await spotifyApi.player.setPlaybackVolume(
          Math.round(args.volumePercent),
          args.deviceId || "",
        );
      });
      return {
        content: [
          {
            type: "text",
            text: `Volume set to ${Math.round(args.volumePercent)}%`,
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

// 10. Adjust Volume
const adjustVolume = {
  name: "adjustVolume",
  description: "Adjust volume relatively",
  schema: {
    adjustment: z.number().min(-100).max(100),
    deviceId: z.string().optional(),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { adjustment, deviceId, _accessToken } = args;

    try {
      // Lógica complexa de volume mantida, apenas adaptada para stateless
      const playback = await handleSpotifyRequest(
        _accessToken,
        async (spotifyApi) => {
          return await spotifyApi.player.getPlaybackState();
        },
      );

      if (!playback?.device) {
        return { content: [{ type: "text", text: "No active device found" }] };
      }

      const currentVolume = playback.device.volume_percent;
      if (currentVolume === null || currentVolume === undefined) {
        return {
          content: [{ type: "text", text: "Unable to get current volume" }],
        };
      }

      const newVolume = Math.min(100, Math.max(0, currentVolume + adjustment));
      await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
        await spotifyApi.player.setPlaybackVolume(
          Math.round(newVolume),
          deviceId || "",
        );
      });

      return {
        content: [
          {
            type: "text",
            text: `Volume adjusted to ${Math.round(newVolume)}%`,
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

export const playTools = [
  playMusic,
  pausePlayback,
  skipToNext,
  skipToPrevious,
  resumePlayback,
  addToQueue,
  setVolume,
  adjustVolume,
];
