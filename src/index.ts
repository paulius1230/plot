import { heartbeat, keepAlive } from "./utils/keepalive.js"
import { ask } from "./utils/log.js"
import {
  broadcastMessage,
  chooseNickname,
  chooseRoom,
  close,
} from "./utils/message.js"
import { Socket, newState } from "./utils/state.js"
import { WebSocketServer } from "ws"

const wss = new WebSocketServer({ port: Number(process.env.PORT) })

// Store rooms and their members
const rooms = new Map<string, Set<Socket>>()

wss.on("connection", (ws: Socket) => {
  const state = newState(ws)
  ask(ws, "Room Code")

  ws.on("message", (data) => {
    const message = data.toString()

    switch (state.status) {
      case "ROOM":
        return chooseRoom(message, state, rooms) // Pass rooms to manage room membership
      case "NICKNAME":
        return chooseNickname(message, state)
      default:
        // Broadcast message to the room
        return broadcastMessage(message, state, rooms)
    }
  })

  ws.on("pong", heartbeat)
  ws.on("close", () => close(state, rooms))
})

// Update broadcastMessage function to broadcast to all members of a room
function broadcastMessage(message: string, state: any, rooms: Map<string, Set<Socket>>) {
  const room = state.room
  if (room && rooms.has(room)) {
    const roomSockets = rooms.get(room)!
    roomSockets.forEach((socket) => {
      if (socket !== state.ws && socket.readyState === socket.OPEN) {
        socket.send(`${state.nickname}: ${message}`)
      }
    })
  }
}

// Modify chooseRoom function to add/remove sockets from rooms
function chooseRoom(roomCode: string, state: any, rooms: Map<string, Set<Socket>>) {
  state.room = roomCode
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, new Set())
  }

  rooms.get(roomCode)!.add(state.ws)
  state.status = "NICKNAME"
  ask(state.ws, "Nickname")
}

// Modify close function to clean up when a user leaves
function close(state: any, rooms: Map<string, Set<Socket>>) {
  const room = state.room
  if (room && rooms.has(room)) {
    const roomSockets = rooms.get(room)!
    roomSockets.delete(state.ws)
    if (roomSockets.size === 0) {
      rooms.delete(room)
    }
  }
}

// Function to manage keeping connections alive
const interval = keepAlive(wss)
wss.on("close", () => clearInterval(interval))
