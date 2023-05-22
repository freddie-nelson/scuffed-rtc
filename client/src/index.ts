import { io, Socket, ManagerOptions, SocketOptions } from "socket.io-client";
import {
    ClientRoom,
    ClientToServerEvents,
    RoomOptions,
    ServerToClientEvents,
} from "../../@types/socketTypes";
import { generateId } from "./id";

export default class Client {
    private namespace: string;
    private serverUrl: URL;
    private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
        null;

    private room: ClientRoom | null = null;

    private eventMap: Map<string, ((...args: any[]) => void)[]> = new Map();

    constructor(namespace: string, serverUrl: string | URL) {
        this.namespace = namespace;
        this.serverUrl = new URL(serverUrl.toString());
    }

    async connect(
        opts: Partial<ManagerOptions & SocketOptions> = { forceNew: true },
    ) {
        this.socket = io(this.serverUrl.toString(), opts);

        await new Promise<void>((resolve, reject) => {
            this.socket.once("connect_error", (err) => reject(err));
            this.socket.once("connect", () => {
                this.socket.removeAllListeners("connect_error");

                // join namespace after connection
                this.socket.emit(
                    "namespace:join",
                    this.namespace,
                    (success, error) => {
                        if (!success) {
                            // if join namespace failed then disconnect
                            reject(new Error(error));
                            this.socket.disconnect();
                        } else resolve();
                    },
                );
            });
        });

        this.addSocketListeners();
    }

    disconnect() {
        if (!this.socket || !this.socket.connected)
            throw new Error("Client is not connected.");

        this.socket.disconnect();
        this.socket = null;
    }

    onRoomUpdate = (room: ClientRoom) => {};

    private addSocketListeners() {
        if (!this.socket || !this.socket.connected)
            throw new Error("Client is not connected.");

        this.socket.on("room:update", (room, serverTime) => {
            this.room = room;
            this.onRoomUpdate(room);
        });

        this.socket.on("room:event", (eventInfo) => {
            this.handleRoomEvent(eventInfo);
        });
    }

    // room events
    createRoom(
        id = generateId(5),
        options: Partial<RoomOptions> = {},
    ): Promise<ClientRoom> {
        if (!this.socket || !this.socket.connected)
            throw new Error("Client is not connected.");

        if (this.room) throw new Error("Client is already in a room.");

        return new Promise((resolve, reject) => {
            this.socket.emit(
                "room:create",
                id,
                options,
                (success, roomOrError) => {
                    if (!success) reject(new Error(roomOrError as string));
                    else {
                        this.room = roomOrError as ClientRoom;
                        resolve(this.room);
                    }
                },
            );
        });
    }

    joinRoom(id: string): Promise<ClientRoom> {
        if (!this.socket || !this.socket.connected)
            throw new Error("Client is not connected.");

        if (this.room) throw new Error("Client is already in a room.");

        return new Promise((resolve, reject) => {
            this.socket.emit("room:join", id, (success, roomOrError) => {
                if (!success) reject(new Error(roomOrError as string));
                else {
                    this.room = roomOrError as ClientRoom;
                    resolve(this.room);
                }
            });
        });
    }

    leaveRoom(): Promise<void> {
        if (!this.socket || !this.socket.connected)
            throw new Error("Client is not connected.");

        if (!this.room) throw new Error("Client is not in a room.");

        return new Promise((resolve, reject) => {
            this.socket.emit("room:leave", (success, error) => {
                if (!success) reject(new Error(error as string));
                else {
                    this.room = null;
                    resolve();
                }
            });
        });
    }

    // room user event handlers
    private handleRoomEvent(eventInfo: {
        event: string;
        data: string;
        sender: string;
        serverTime: number;
    }) {
        const { event, data, sender, serverTime } = eventInfo;

        const listeners = this.eventMap.get(event);
        if (listeners) {
            for (const listener of listeners) {
                listener({ data, sender, serverTime });
            }
        }

        const anyListeners = this.eventMap.get("*");
        if (anyListeners) {
            for (const listener of anyListeners) {
                listener(event, { data, sender, serverTime });
            }
        }
    }

    on(event: string, callback: (...args: any[]) => void) {
        if (!this.eventMap.has(event)) this.eventMap.set(event, []);

        const listeners = this.eventMap.get(event);
        if (listeners.indexOf(callback) !== -1)
            throw new Error("Callback already exists.");

        listeners.push(callback);
    }

    onAny(callback: (event: string, ...args: any[]) => void) {
        this.on("*", callback);
    }

    off(event: string, callback: (...args: any[]) => void) {
        if (!this.eventMap.has(event)) throw new Error("Event does not exist.");

        const eventCallbacks = this.eventMap.get(event)!;
        const i = eventCallbacks.indexOf(callback);
        eventCallbacks.splice(i, 1);
    }

    offAny(callback: (event: string, ...args: any[]) => void) {
        this.off("*", callback);
    }

    removeAllListeners(event: string) {
        this.eventMap.set(event, []);
    }

    // user events
    emit(event: string, data: any): Promise<void> {
        if (!this.socket || !this.socket.connected)
            throw new Error("Client is not connected.");

        if (!this.room) throw new Error("Client is not in a room.");

        return new Promise<void>((resolve, reject) => {
            this.socket.emit(
                "room:event",
                { event, data },
                (success, error) => {
                    if (!success) reject(new Error(error as string));
                    else resolve();
                },
            );
        });
    }

    // getters
    getNamespace() {
        return this.namespace;
    }

    getServerUrl() {
        return this.serverUrl;
    }

    getSocket() {
        return this.socket;
    }
}
