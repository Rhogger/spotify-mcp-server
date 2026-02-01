import { z } from "zod";
import type { tool } from "./types.js";
import { handleSpotifyRequest, authSchema, formatError } from "./utils.js";

type WithToken<T> = T & { _accessToken?: string };

const playMusic = {
  name: "playMusic",
  description: "Start playing a Spotify track, album, artist, or playlist",
  schema: {
    uri: z
      .string()
      .optional()
      .describe("The Spotify URI to play (overrides type and id)"),
    uris: z
      .array(z.string())
      .optional()
      .describe("An array of Spotify track URIs to play"),
    contextUri: z
      .string()
      .optional()
      .describe("The Spotify context URI to play (album, artist, playlist)"),
    type: z
      .enum(["track", "album", "artist", "playlist"])
      .optional()
      .describe("The type of item to play (used with id)"),
    id: z.string().optional().describe("The Spotify ID of the item to play"),
    offset: z
      .object({
        position: z.number().optional(),
        uri: z.string().optional(),
      })
      .optional()
      .describe("Indicates from where in the context playback should start"),
    deviceId: z
      .string()
      .optional()
      .describe("The Spotify device ID to play on"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { uri, uris, contextUri, type, id, offset, deviceId, _accessToken } =
      args;

    if (!(uri || uris || contextUri || (type && id))) {
      await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
        await spotifyApi.player.startResumePlayback(deviceId || "");
      });
      return { content: [{ type: "text", text: "Resumed playback" }] };
    }

    let finalContextUri = contextUri;
    let finalUris = uris;

    if (!finalContextUri && !finalUris) {
      if (uri) {
        if (uri.includes(":track:")) {
          finalUris = [uri];
        } else {
          finalContextUri = uri;
        }
      } else if (type && id) {
        const generatedUri = `spotify:${type}:${id}`;
        if (type === "track") {
          finalUris = [generatedUri];
        } else {
          finalContextUri = generatedUri;
        }
      }
    }

    await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
      await spotifyApi.player.startResumePlayback(
        deviceId || "",
        finalContextUri,
        finalUris,
        offset,
      );
    });

    return {
      content: [
        {
          type: "text",
          text: `Started playback successfully.`,
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

const transferPlayback = {
  name: "transferPlayback",
  description: "Transfer playback to a new device",
  schema: {
    deviceId: z.string().describe("The device ID to transfer playback to"),
    play: z
      .boolean()
      .optional()
      .describe("Whether to start playback on the new device (default: false)"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { deviceId, play = false, _accessToken } = args;

    try {
      await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
        await spotifyApi.player.transferPlayback([deviceId], play);
      });
      return {
        content: [
          {
            type: "text",
            text: `Playback transferred to device: ${deviceId}`,
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

const setShuffle = {
  name: "setShuffle",
  description: "Toggle shuffle on or off",
  schema: {
    state: z.boolean().describe("true to enable shuffle, false to disable"),
    deviceId: z.string().optional().describe("The device ID to target"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { state, deviceId, _accessToken } = args;

    try {
      await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
        await spotifyApi.player.togglePlaybackShuffle(state, deviceId || "");
      });
      return {
        content: [
          {
            type: "text",
            text: `Shuffle ${state ? "enabled" : "disabled"}`,
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

const setRepeatMode = {
  name: "setRepeatMode",
  description: "Set the repeat mode for playback",
  schema: {
    state: z
      .enum(["track", "context", "off"])
      .describe("track, context or off"),
    deviceId: z.string().optional().describe("The device ID to target"),
    ...authSchema,
  },
  handler: async (rawArgs, _extra) => {
    const args = rawArgs as WithToken<typeof rawArgs>;
    const { state, deviceId, _accessToken } = args;

    try {
      await handleSpotifyRequest(_accessToken, async (spotifyApi) => {
        await spotifyApi.player.setRepeatMode(state, deviceId || "");
      });
      return {
        content: [
          {
            type: "text",
            text: `Repeat mode set to: ${state}`,
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
  transferPlayback,
  setShuffle,
  setRepeatMode,
];
