<div align="center" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
<img src="https://upload.wikimedia.org/wikipedia/commons/8/84/Spotify_icon.svg" width="30" height="30">
<h1>Spotify MCP Server</h1>
</div>

Um servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io) leve que permite que assistentes de IA controlem a reprodução do Spotify e gerenciem playlists.

> **Nota:** Este projeto é um fork de [marcelmarais/spotify-mcp-server](https://github.com/marcelmarais/spotify-mcp-server). Todos os créditos ao autor original.

**Aviso Importante:** Esta versão do servidor MCP foi adaptada **exclusivamente** para ser consumida por um backend via endpoints ou agentes de IA. Ele não foi projetado para uso direto em IDEs (como Cursor ou VSCode) da maneira tradicional, pois remove a gestão local de credenciais em favor de tokens injetados pelo consumidor.

<details>
<summary>Conteúdo</summary>

- [Exemplos de Interações](#exemplos-de-interações)
- [Ferramentas](#ferramentas)
  - [Operações de Leitura](#operações-de-leitura)
  - [Operações de Álbum](#operações-de-álbum)
  - [Operações de Reprodução / Criação](#operações-de-reprodução--criação)
- [Configuração e Autenticação](#configuração-e-autenticação)
  - [Pré-requisitos](#pré-requisitos)
  - [Instalação](#instalação)
  - [Token de Acesso](#token-de-acesso)
</details>

## Exemplos de Interações

- _"Toque a primeira música do Elvis"_
- _"Crie uma playlist de fusão entre Taylor Swift e Slipknot"_
- _"Copie todas as faixas de techno da minha playlist de treino para a minha playlist de trabalho"_
- _"Abaixe um pouco o volume"_

## Ferramentas

Todas as ferramentas abaixo esperam que o ambiente de execução (Backend ou Agente) forneça um Token de Acesso válido para o Spotify.

### Operações de Leitura

1. **searchSpotify**

   - **Descrição**: Pesquisa por faixas, álbuns, artistas ou playlists no Spotify
   - **Parâmetros**:
     - `query` (string): O termo de pesquisa
     - `type` (string): Tipo de item para pesquisar (track, album, artist, playlist)
     - `limit` (number, opcional): Número máximo de resultados (10-50)
   - **Retorno**: Lista de itens correspondentes com seus IDs, nomes e detalhes adicionais
   - **Exemplo**: `searchSpotify("bohemian rhapsody", "track", 20)`

2. **getNowPlaying**

   - **Descrição**: Obtém informações sobre a faixa tocando atulamente no Spotify, incluindo dispositivo e volume
   - **Parâmetros**: Nenhum
   - **Retorno**: Objeto contendo nome da faixa, artista, álbum, progresso, duração, estado, dispositivo, volume e status de shuffle/repeat
   - **Exemplo**: `getNowPlaying()`

3. **getMyPlaylists**

   - **Descrição**: Obtém a lista de playlists do usuário atual no Spotify
   - **Parâmetros**:
     - `limit` (number, opcional): Número máximo de playlists (default: 20)
     - `offset` (number, opcional): Índice da primeira playlist (default: 0)
   - **Retorno**: Array de playlists com IDs, nomes, contagem de faixas e status público
   - **Exemplo**: `getMyPlaylists(10, 0)`

4. **getPlaylistTracks**

   - **Descrição**: Obtém uma lista de faixas de uma playlist específica
   - **Parâmetros**:
     - `playlistId` (string): O ID Spotify da playlist
     - `limit` (number, opcional): Número máximo de faixas (default: 100)
     - `offset` (number, opcional): Índice da primeira faixa (default: 0)
   - **Retorno**: Array de faixas com IDs, nomes, artistas, álbum, duração e data de adição
   - **Exemplo**: `getPlaylistTracks("37i9dQZEVXcJZyENOWUFo7")`

5. **getRecentlyPlayed**

   - **Descrição**: Recupera uma lista de faixas reproduzidas recentemente.
   - **Parâmetros**:
     - `limit` (number, opcional): Número máximo de faixas a retornar.
   - **Retorno**: Lista formatada de faixas recentes ou mensagem se nenhuma for encontrada.
   - **Exemplo**: `getRecentlyPlayed({ limit: 10 })`

6. **getUsersSavedTracks**

   - **Descrição**: Obtém a lista de faixas salvas na biblioteca "Músicas Curtidas" do usuário
   - **Parâmetros**:
     - `limit` (number, opcional): Máximo de faixas (1-50, default: 50)
     - `offset` (number, opcional): Paginação (índice base 0, default: 0)
   - **Retorno**: Lista formatada com nomes, artistas, duração, IDs e data de adição. Mostra info de paginação.
   - **Exemplo**: `getUsersSavedTracks({ limit: 20, offset: 0 })`

7. **getQueue**

   - **Descrição**: Obtém a faixa atual e os próximos itens na fila do Spotify
   - **Parâmetros**:
     - `limit` (number, opcional): Máximo de itens seguintes para mostrar (1-50, default: 10)
   - **Retorno**: Faixa atual e lista de próximas faixas na fila
   - **Exemplo**: `getQueue({ limit: 20 })`

8. **getAvailableDevices**

   - **Descrição**: Obtém informações sobre dispositivos Spotify Connect disponíveis
   - **Parâmetros**: Nenhum
   - **Retorno**: Lista de dispositivos com nome, tipo, status ativo, volume e ID
   - **Exemplo**: `getAvailableDevices()`


### Operações de Reprodução / Criação

1. **playMusic**

   - **Descrição**: Inicia a reprodução de uma faixa, álbum, artista ou playlist
   - **Parâmetros**:
     - `uri` (string, opcional): URI Spotify do item (sobrescreve type e id)
     - `type` (string, opcional): Tipo de item (track, album, artist, playlist)
     - `id` (string, opcional): ID Spotify do item
     - `deviceId` (string, opcional): ID do dispositivo
   - **Retorno**: Status de sucesso
   - **Exemplo**: `playMusic({ uri: "spotify:track:6rqhFgbbKwnb9MLmUQDhG6" })`
   - **Alternativa**: `playMusic({ type: "track", id: "6rqhFgbbKwnb9MLmUQDhG6" })`

2. **pausePlayback**

   - **Descrição**: Pausa a faixa atual
   - **Parâmetros**:
     - `deviceId` (string, opcional): ID do dispositivo
   - **Retorno**: Status de sucesso
   - **Exemplo**: `pausePlayback()`

3. **resumePlayback**

   - **Descrição**: Retoma a reprodução no dispositivo ativo
   - **Parâmetros**:
     - `deviceId` (string, opcional): ID do dispositivo
   - **Retorno**: Status de sucesso
   - **Exemplo**: `resumePlayback()`

4. **skipToNext**

   - **Descrição**: Pula para a próxima faixa na fila
   - **Parâmetros**:
     - `deviceId` (string, opcional): ID do dispositivo
   - **Retorno**: Status de sucesso
   - **Exemplo**: `skipToNext()`

5. **skipToPrevious**

   - **Descrição**: Volta para a faixa anterior na fila
   - **Parâmetros**:
     - `deviceId` (string, opcional): ID do dispositivo
   - **Retorno**: Status de sucesso
   - **Exemplo**: `skipToPrevious()`

6. **createPlaylist**

   - **Descrição**: Cria uma nova playlist
   - **Parâmetros**:
     - `name` (string): Nome da nova playlist
     - `description` (string, opcional): Descrição da playlist
     - `public` (boolean, opcional): Se deve ser pública (default: false)
   - **Retorno**: Objeto com ID e URL da nova playlist
   - **Exemplo**: `createPlaylist({ name: "Workout Mix", description: "Musicas para treinar", public: false })`

7. **addTracksToPlaylist**

   - **Descrição**: Adiciona faixas a uma playlist existente
   - **Parâmetros**:
     - `playlistId` (string): ID da playlist
     - `trackUris` (array): Array de URIs ou IDs de faixas
     - `position` (number, opcional): Posição para inserir as faixas
   - **Retorno**: Status de sucesso e snapshot ID
   - **Exemplo**: `addTracksToPlaylist({ playlistId: "3cEYpjA9oz9GiPac4AsH4n", trackUris: ["spotify:track:4iV5W9uYEdYUVa79Axb7Rh"] })`

8. **addToQueue**

   - **Descrição**: Adiciona uma faixa, álbum, artista ou playlist à fila atual
   - **Parâmetros**:
     - `uri` (string, opcional): URI Spotify do item (sobrescreve type e id)
     - `type` (string, opcional): Tipo de item (track, album, artist, playlist)
     - `id` (string, opcional): ID Spotify do item
     - `deviceId` (string, opcional): ID do dispositivo
   - **Retorno**: Status de sucesso
   - **Exemplo**: `addToQueue({ uri: "spotify:track:6rqhFgbbKwnb9MLmUQDhG6" })`
   - **Alternativa**: `addToQueue({ type: "track", id: "6rqhFgbbKwnb9MLmUQDhG6" })`

9. **setVolume**

   - **Descrição**: Define o volume para uma porcentagem específica (requer Spotify Premium)
   - **Parâmetros**:
     - `volumePercent` (number): Volume a definir (0-100)
     - `deviceId` (string, opcional): ID do dispositivo
   - **Retorno**: Status de sucesso com novo nível de volume
   - **Exemplo**: `setVolume({ volumePercent: 50 })`

10. **adjustVolume**

    - **Descrição**: Ajusta o volume para cima ou para baixo (requer Spotify Premium)
    - **Parâmetros**:
      - `adjustment` (number): Quantidade para ajustar (-100 a 100). Positivo aumenta, negativo diminui.
      - `deviceId` (string, opcional): ID do dispositivo
    - **Retorno**: Status de sucesso mostrando a mudança (ex: "Volume increased from 50% to 60%")
    - **Exemplo**: `adjustVolume({ adjustment: 10 })` (aumenta 10%)
    - **Exemplo**: `adjustVolume({ adjustment: -20 })` (diminui 20%)


### Operações de Álbum

1. **getAlbums**

   - **Descrição**: Obtém informações detalhadas sobre um ou mais álbuns
   - **Parâmetros**:
     - `albumIds` (string|array): Um ID único ou array de IDs (máx 20)
   - **Retorno**: Detalhes do álbum incluindo nome, artistas, data, tipo, total de faixas e ID.
   - **Exemplo**: `getAlbums("4aawyAB9vmqN3uQ7FjRGTy")`

2. **getAlbumTracks**

   - **Descrição**: Obtém faixas de um álbum específico com paginação
   - **Parâmetros**:
     - `albumId` (string): O ID Spotify do álbum
     - `limit` (number, opcional): Máximo de faixas (1-50)
     - `offset` (number, opcional): Offset para paginação
   - **Retorno**: Lista de faixas do álbum com detalhes.
   - **Exemplo**: `getAlbumTracks("4aawyAB9vmqN3uQ7FjRGTy", 10, 0)`

3. **saveOrRemoveAlbumForUser**

   - **Descrição**: Salva ou remove álbuns da biblioteca do usuário
   - **Parâmetros**:
     - `albumIds` (array): Array de IDs de álbuns (máx 20)
     - `action` (string): Ação: "save" ou "remove"
   - **Retorno**: Confirmação visual
   - **Exemplo**: `saveOrRemoveAlbumForUser(["4aawyAB9vmqN3uQ7FjRGTy"], "save")`

4. **checkUsersSavedAlbums**

   - **Descrição**: Verifica se álbuns estão salvos na biblioteca
   - **Parâmetros**:
     - `albumIds` (array): Array de IDs para verificar (máx 20)
   - **Retorno**: Status de cada álbum (saved ou not saved)
   - **Exemplo**: `checkUsersSavedAlbums(["4aawyAB9vmqN3uQ7FjRGTy", "1DFixLWuPkv3KT3TnV35m3"])`

## Configuração e Autenticação

### Pré-requisitos

- Node.js v16+
- Uma conta Spotify Premium
- Um backend ou agente capaz de realizar a autenticação OAuth 2.0 com o Spotify e fornecer o token de acesso.

### Instalação e Execução

#### Via Docker (Recomendado)

A execução principal deste serviço é orquestrada via Docker como parte do sistema agêntico. Consulte o repositório de infraestrutura para instruções detalhadas sobre como subir o container:

👉 **[https://github.com/Rhogger/spotify-agentic-system-infra](https://github.com/Rhogger/spotify-agentic-system-infra)**

#### Execução Local (Desenvolvimento)

Caso deseje rodar o servidor localmente para testes ou desenvolvimento:

1. Clone o repositório e instale as dependências:
   ```bash
   git clone https://github.com/marcelmarais/spotify-mcp-server.git
   cd spotify-mcp-server
   npm install
   ```

2. Compile o projeto:
   ```bash
   npm run build
   ```

3. Inicie o servidor:
   ```bash
   # Opcional: Definir porta customizada (Padrão: 3000)
   export PORT=3000
   node build/index.js
   ```

O servidor iniciará (padrão porta 3000) e aguardará conexões SSE em `/sse`. Lembra-se que o consumidor deve injetar o token de acesso em cada chamada de ferramenta.

### Token de Acesso

Ao contrário do servidor original, esta versão **não utiliza um arquivo `spotify-config.json`** para credenciais.

A autenticação é delegada inteiramente para o consumidor (o Backend ou Agente de IA). Toda vez que uma ferramenta (tool) é chamada, o consumidor deve injetar o token de acesso do usuário.

O servidor espera que o token esteja válido e com os escopos apropriados para as operações solicitadas. Se o token estiver expirado ou ausente, a chamada da ferramenta falhará.
