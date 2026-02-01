import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { z } from "zod";

/**
 * Cria uma instância da API do Spotify usando o token injetado pelo Backend.
 * No modo Stateless, não lemos mais arquivos locais.
 */
export async function createSpotifyApi(
  accessToken: string,
): Promise<SpotifyApi> {
  if (!accessToken) {
    throw new Error("Access token is missing. The backend should inject this.");
  }

  return SpotifyApi.withAccessToken("spotify-agentic-system", {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "",
  });
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds.padStart(2, "0")}`;
}

/**
 * Wrapper auxiliar para executar ações do Spotify.
 * Agora ele EXIGE o accessToken como primeiro argumento.
 */
export async function handleSpotifyRequest<T>(
  accessToken: string | undefined,
  action: (spotifyApi: SpotifyApi) => Promise<T>,
): Promise<T> {
  if (!accessToken) {
    throw new Error(
      "Internal Error: Spotify Access Token was not injected into the tool arguments.",
    );
  }

  try {
    const spotifyApi = await createSpotifyApi(accessToken);
    return await action(spotifyApi);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("Unexpected token") ||
      errorMessage.includes("Unexpected non-whitespace character") ||
      errorMessage.includes("Exponent part is missing a number in JSON")
    ) {
      return undefined as T;
    }
    throw error;
  }
}

export const authSchema = {
  _accessToken: z
    .string()
    .optional()
    .describe("Internal: Injected Access Token"),
};

export function formatError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);

  try {
    const jsonMatch = message.match(/\{.*\}/);
    if (jsonMatch) {
      const errorObj = JSON.parse(jsonMatch[0]);
      if (errorObj?.error?.message) {
        return `Error: ${errorObj.error.message} (Status: ${errorObj.error.status})`;
      }
    }
  } catch (e) {
  }

  if (!message.startsWith("Error")) {
    return `Error: ${message}`;
  }
  return message;
}
