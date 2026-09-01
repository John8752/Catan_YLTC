import { describe, expect, it } from "vitest";
import { RoomRegistry } from "./rooms.js";
import {
  AiCommentaryUpstreamError,
  buildAiGameContext,
  DeepSeekCommentator,
  type PublicSetupAnalysisInput,
} from "./ai-commentary.js";

describe("DeepSeekCommentator", () => {
  it("sends a compact player-safe snapshot with the key only in the authorization header", async () => {
    const { room, registry } = startedRoom();
    let capturedUrl: string | URL | Request = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedUrl = input;
      capturedInit = init;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "  这桌的木头气氛有点紧张。  " } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const commentator = new DeepSeekCommentator({ apiKey: "secret-key", fetchImpl });

    await expect(commentator.analyze(room, "commentary")).resolves.toBe("这桌的木头气氛有点紧张。");

    expect(capturedUrl).toBe("https://api.deepseek.com/chat/completions");
    expect(capturedInit?.headers).toMatchObject({ authorization: "Bearer secret-key" });
    const body = String(capturedInit?.body);
    expect(body).not.toContain("secret-key");
    expect(body).not.toContain("seat_");
    expect(JSON.parse(body)).toMatchObject({
      model: "deepseek-v4-flash",
      thinking: { type: "disabled" },
      stream: false,
    });
    registry.dispose();
  });

  it("normalizes malformed upstream responses into a safe public error", async () => {
    const { room, registry } = startedRoom();
    const commentator = new DeepSeekCommentator({
      apiKey: "secret-key",
      fetchImpl: async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    });

    await expect(commentator.analyze(room, "summary")).rejects.toBeInstanceOf(AiCommentaryUpstreamError);
    registry.dispose();
  });

  it("requests strict public setup JSON and maps stable player keys back to public ids", async () => {
    let requestBody = "";
    const commentator = new DeepSeekCommentator({
      apiKey: "secret-key",
      fetchImpl: async (_input, init) => {
        requestBody = String(init?.body);
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
          playerComments: [
            { playerKey: "P1", comment: "林的点数覆盖均衡，前期路线比较灵活。" },
            { playerKey: "P2", comment: "周靠近专港，资源兑现路径很清楚。" },
          ],
          predictedWinnerKey: "P2",
          prediction: "周的公开选点组合略占优势，不过这只是娱乐性推测。",
        }) } }] }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });

    await expect(commentator.analyzeSetup(setupInput())).resolves.toEqual({
      playerComments: [
        { playerId: "player_1", comment: "林的点数覆盖均衡，前期路线比较灵活。" },
        { playerId: "player_2", comment: "周靠近专港，资源兑现路径很清楚。" },
      ],
      predictedWinnerId: "player_2",
      prediction: "周的公开选点组合略占优势，不过这只是娱乐性推测。",
    });
    expect(JSON.parse(requestBody)).toMatchObject({ response_format: { type: "json_object" } });
    expect(requestBody).not.toContain("player_1");
    expect(requestBody).not.toContain("resources");
  });
});

describe("buildAiGameContext", () => {
  it("keeps useful public positions and the viewer's own hand without copying transport secrets", () => {
    const { room, registry } = startedRoom();
    const serialized = JSON.stringify(buildAiGameContext(room));

    expect(serialized).toContain('"currentPlayer"');
    expect(serialized).toContain('"positions"');
    expect(serialized).not.toContain("seatToken");
    expect(serialized).not.toContain(room.id);
    registry.dispose();
  });
});

function startedRoom() {
  const registry = new RoomRegistry();
  const host = registry.createRoom("林");
  registry.joinRoom(host.roomId, "周");
  registry.joinRoom(host.roomId, "陈");
  const room = registry.startRoom(host.roomId, host.seatToken);
  return { registry, room };
}

function setupInput(): PublicSetupAnalysisInput {
  return {
    ruleProfile: "base-3-4",
    victoryPointsToWin: 10,
    sourceRevision: 13,
    firstPlayerKey: "P1",
    players: [
      {
        playerKey: "P1",
        playerId: "player_1",
        name: "林",
        settlements: [{ adjacentHexes: [{ terrain: "grain", number: 6, robber: false }], port: null }],
      },
      {
        playerKey: "P2",
        playerId: "player_2",
        name: "周",
        settlements: [{ adjacentHexes: [{ terrain: "ore", number: 8, robber: false }], port: { kind: "resource", resource: "ore" } }],
      },
    ],
  };
}
