#!/usr/bin/env python3
"""
Undercover – Python WebSocket + HTTP server
  HTTP  → port 3000 (serves public/)
  WS    → port 3001 (game logic)
"""
import asyncio
import json
import os
import random
import time
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
import websockets

# ── Game data ────────────────────────────────────────────────
MISSIONS = [
    "Get someone to say 'wallah'",
    "Make someone laugh out loud",
    "Get someone to check their phone",
    "Get someone to talk about food",
    "Convince someone to order dessert",
    "Get someone to stand up from their seat",
    "Make someone say 'seriously?'",
    "Get someone to look at the ceiling",
    "Make someone say your name twice",
    "Get someone to give you a high five",
    "Get someone to hum any song",
    "Make someone say 'I don't know'",
    "Get someone to compliment you",
    "Make someone look at their watch",
    "Get someone to say 'no way'",
    "Make two people shake hands",
    "Get someone to take a sip of their drink",
    "Make someone say a number over 100",
    "Get someone to snap their fingers",
    "Make someone say 'let's go'",
]

# ── Shared state (asyncio is single-threaded – no locks needed) ──
rooms   = {}   # code  → room dict
sockets = {}   # pid   → websocket

# ── Helpers ──────────────────────────────────────────────────
def gen_code():
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(random.choices(chars, k=4))
        if code not in rooms:
            return code

def serialize_players(room):
    return [
        {
            "id":               p["id"],
            "name":             p["name"],
            "isHost":           p["id"] == room["hostId"],
            "missionCompleted": p["missionCompleted"],
        }
        for p in room["players"]
    ]

async def send_to(pid, data):
    ws = sockets.get(pid)
    if ws:
        try:
            await ws.send(json.dumps(data))
        except Exception:
            pass

async def broadcast(code, data):
    room = rooms.get(code)
    if not room:
        return
    for p in list(room["players"]):
        await send_to(p["id"], data)

# ── WebSocket handler ─────────────────────────────────────────
async def handler(websocket):
    pid       = str(id(websocket))
    room_code = None
    sockets[pid] = websocket

    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            t = msg.get("type", "")

            # ── createRoom ──────────────────────────────────
            if t == "createRoom":
                name = str(msg.get("playerName", "")).strip()[:20]
                if not name:
                    continue
                code = gen_code()
                room_code = code
                rooms[code] = {
                    "code":    code,
                    "hostId":  pid,
                    "status":  "lobby",
                    "players": [
                        {"id": pid, "name": name,
                         "mission": None, "missionCompleted": False,
                         "completedAt": None}
                    ],
                }
                await send_to(pid, {
                    "type":    "roomCreated",
                    "code":    code,
                    "playerId": pid,
                    "hostId":  pid,
                    "players": serialize_players(rooms[code]),
                })

            # ── joinRoom ────────────────────────────────────
            elif t == "joinRoom":
                name = str(msg.get("playerName", "")).strip()[:20]
                code = str(msg.get("code", "")).upper().strip()
                room = rooms.get(code)
                if not room:
                    await send_to(pid, {"type": "joinError", "message": "Room not found. Check your code."})
                    continue
                if room["status"] != "lobby":
                    await send_to(pid, {"type": "joinError", "message": "Game already in progress."})
                    continue
                room_code = code
                room["players"].append({
                    "id": pid, "name": name,
                    "mission": None, "missionCompleted": False,
                    "completedAt": None
                })
                await send_to(pid, {
                    "type":    "joinedRoom",
                    "code":    code,
                    "playerId": pid,
                    "hostId":  room["hostId"],
                    "players": serialize_players(room),
                })
                # notify others
                for p in room["players"]:
                    if p["id"] != pid:
                        await send_to(p["id"], {
                            "type":    "lobbyUpdate",
                            "players": serialize_players(room),
                            "hostId":  room["hostId"],
                        })

            # ── startGame ───────────────────────────────────
            elif t == "startGame":
                code = str(msg.get("code", ""))
                room = rooms.get(code)
                if not room or room["hostId"] != pid or room["status"] != "lobby":
                    continue
                if len(room["players"]) < 2:
                    await send_to(pid, {"type": "startError", "message": "Need at least 2 players to start!"})
                    continue
                room["status"] = "playing"
                shuffled = random.sample(MISSIONS, len(MISSIONS))
                for i, p in enumerate(room["players"]):
                    p["mission"] = shuffled[i % len(shuffled)]
                # send each player their own mission
                for p in room["players"]:
                    await send_to(p["id"], {
                        "type":    "gameStarted",
                        "mission": p["mission"],
                        "players": [
                            {"id": pl["id"], "name": pl["name"],
                             "missionCompleted": pl["missionCompleted"]}
                            for pl in room["players"]
                        ],
                    })

            # ── completeMission → game ends immediately for all ──
            elif t == "completeMission":
                code = str(msg.get("code", ""))
                room = rooms.get(code)
                if not room or room["status"] != "playing":
                    continue
                player = next((p for p in room["players"] if p["id"] == pid), None)
                if not player or player["missionCompleted"]:
                    continue
                player["missionCompleted"] = True
                player["completedAt"]      = time.time()
                room["status"] = "ended"

                # rank: winner = 1, others keep join order (2, 3, 4 …)
                rank_counter = 2
                player_data  = []
                for p in room["players"]:
                    if p["id"] == pid:
                        r = 1
                    else:
                        r = rank_counter
                        rank_counter += 1
                    player_data.append({
                        "id":               p["id"],
                        "name":             p["name"],
                        "mission":          p["mission"],
                        "missionCompleted": p["missionCompleted"],
                        "completedAt":      p["completedAt"],
                        "rank":             r,
                    })

                await broadcast(code, {
                    "type":     "gameEnded",
                    "winnerId": pid,
                    "players":  player_data,
                })

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        sockets.pop(pid, None)
        if room_code and room_code in rooms:
            room = rooms[room_code]
            room["players"] = [p for p in room["players"] if p["id"] != pid]
            if not room["players"]:
                del rooms[room_code]
                return
            if room["hostId"] == pid:
                room["hostId"] = room["players"][0]["id"]
                await send_to(room["hostId"], {"type": "youAreHost"})
            for p in room["players"]:
                await send_to(p["id"], {
                    "type":    "lobbyUpdate",
                    "players": serialize_players(room),
                    "hostId":  room["hostId"],
                })


# ── HTTP server for static files ──────────────────────────────
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

class StaticHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)
    def log_message(self, format, *args):
        pass  # keep terminal quiet

def run_http():
    server = HTTPServer(("", 3000), StaticHandler)
    server.serve_forever()


# ── Entry point ───────────────────────────────────────────────
async def main():
    http_thread = threading.Thread(target=run_http, daemon=True)
    http_thread.start()

    print("🕵️  Undercover is running!")
    print("   Open: http://localhost:3000")
    print("   Share your LAN IP with friends to play together")
    print()

    # Accept WebSocket from any origin (local network play)
    async with websockets.serve(handler, "0.0.0.0", 3001, origins=None):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
