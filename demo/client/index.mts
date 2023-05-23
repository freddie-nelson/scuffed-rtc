import Client from "../../client/dist/index.js";

const connectionStatus = document.getElementById("connection-status") as HTMLParagraphElement;

const currentRoom = document.getElementById("currentRoom") as HTMLParagraphElement;
const roomInput = document.getElementById("roomInput") as HTMLInputElement;
const createRoomButton = document.getElementById("createRoomButton") as HTMLButtonElement;
const joinRoomButton = document.getElementById("joinRoomButton") as HTMLButtonElement;
const leaveRoomButton = document.getElementById("leaveRoomButton") as HTMLButtonElement;

const messageInput = document.getElementById("messageInput") as HTMLInputElement;
const sendMessageButton = document.getElementById("sendMessageButton") as HTMLButtonElement;
const messages = document.getElementById("messages") as HTMLDivElement;

createRoomButton.addEventListener("click", async () => {
  const room = roomInput.value || undefined;
  currentRoom.innerText = `Current Room: ${JSON.stringify(await client.createRoom(room))}`;
});

joinRoomButton.addEventListener("click", async () => {
  const room = roomInput.value;
  currentRoom.innerText = `Current Room: ${JSON.stringify(await client.joinRoom(room))}`;
});

leaveRoomButton.addEventListener("click", async () => {
  await client.leaveRoom();

  currentRoom.innerText = `Current Room: N/A`;
});

sendMessageButton.addEventListener("click", async () => {
  const message = messageInput.value;
  client.emit("msg", { message, time: Date.now() });
});

interface CToSEvents {
  msg: { message: string; time: number };
}

interface SToCEvents {
  msg: { message: string; time: number };
}

const client = new Client<SToCEvents, CToSEvents>("demo", "http://localhost:3000");

(async () => {
  connectionStatus.innerText = "connecting...";
  try {
    await client.connect();
    connectionStatus.innerText = "connected";
    console.log("connected to server");
  } catch (error) {
    connectionStatus.innerText = `failed to connect due to '${error.message}'`;
  }

  client.on("msg", (data) => {
    const message = document.createElement("p");
    message.innerText = `[${new Date().toISOString()}]: ${JSON.stringify(data)}`;
    messages.appendChild(message);
  });

  client.onRoomUpdate = (room) => {
    currentRoom.innerText = `Current Room: ${JSON.stringify(room)}`;
  };
})();
