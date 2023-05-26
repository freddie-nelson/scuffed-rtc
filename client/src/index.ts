import { io, Socket, ManagerOptions, SocketOptions } from "socket.io-client";
import {
    ClientRoom,
    ClientToServerEvents,
    RoomOptions,
    ServerToClientEvents,
} from "../@types/socketTypes";
import { generateId } from "./id";

export interface EventInfo<T> {
    data: T;
    serverTime: number;
    sender: string;
}

export interface DefaultSToCEvents {
    [index: string]: any;
}

export interface DefaultCToSEvents {
    [index: string]: any;
}

export default class Client<
    SToCEvents extends DefaultCToSEvents,
    CToSEvents extends DefaultCToSEvents,
> {
    private namespace: string;
    private serverUrl: URL;
    private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
        null;

    private room: ClientRoom | null = null;

    private eventMap: Partial<{
        [K in keyof SToCEvents]: ((info: EventInfo<SToCEvents[K]>) => void)[];
    }> = {};
    private onAnyListeners: (<T extends keyof SToCEvents>(
        event: T,
        info: EventInfo<SToCEvents[T]>,
    ) => void)[] = [];

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

    onRoomUpdate = (room: ClientRoom, serverTime: number) => {
        room;
        serverTime;
    };

    private addSocketListeners() {
        if (!this.socket || !this.socket.connected)
            throw new Error("Client is not connected.");

        this.socket.on("room:update", (room, serverTime) => {
            this.room = room;
            if (this.onRoomUpdate) this.onRoomUpdate(room, serverTime);
        });

        this.socket.on("room:event", (eventInfo) => {
            const event = eventInfo.event as keyof SToCEvents;
            if (!this.eventMap[event]) return;

            this.handleRoomEvent({
                event,
                ...eventInfo,
            });
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
        event: keyof SToCEvents;
        data: any;
        sender: string;
        serverTime: number;
    }) {
        const { event, data, sender, serverTime } = eventInfo;

        const listeners = this.eventMap[event];
        if (listeners) {
            for (const listener of listeners) {
                listener({ data, sender, serverTime });
            }
        }

        const anyListeners = this.onAnyListeners;
        if (anyListeners) {
            for (const listener of anyListeners) {
                listener(event, { data, sender, serverTime });
            }
        }
    }

    on<T extends keyof SToCEvents>(
        event: T,
        callback: (eventInfo: EventInfo<SToCEvents[T]>) => void,
    ) {
        if (!this.eventMap[event]) this.eventMap[event] = [];

        const listeners = this.eventMap[event];
        if (listeners.indexOf(callback) !== -1)
            throw new Error("Callback already exists.");

        listeners.push(callback);
    }

    onAny<T extends keyof SToCEvents>(
        callback: (event: T, eventInfo: EventInfo<SToCEvents[T]>) => void,
    ) {
        // @ts-expect-error - event is a valid key
        this.onAnyListeners.push(callback);
    }

    off<T extends keyof SToCEvents>(
        event: T,
        callback: (eventInfo: EventInfo<SToCEvents[T]>) => void,
    ) {
        if (!this.eventMap[event]) throw new Error("Event does not exist.");

        const eventCallbacks = this.eventMap[event];
        const i = eventCallbacks.indexOf(callback);
        if (i === -1) throw new Error("Callback does not exist.");

        eventCallbacks.splice(i, 1);
    }

    offAny<T extends keyof SToCEvents>(
        callback: (event: T, eventInfo: EventInfo<SToCEvents[T]>) => void,
    ) {
        // @ts-expect-error - event is a valid key
        const i = this.onAnyListeners.indexOf(callback);
        if (i === -1) throw new Error("Callback does not exist.");

        this.onAnyListeners.splice(i, 1);
    }

    removeAllListeners(event: keyof SToCEvents) {
        this.eventMap[event] = [];
    }

    // user events
    emit<T extends keyof CToSEvents>(
        event: T,
        data: CToSEvents[T],
    ): Promise<void> {
        if (!this.socket || !this.socket.connected)
            throw new Error("Client is not connected.");

        if (!this.room) throw new Error("Client is not in a room.");

        return new Promise<void>((resolve, reject) => {
            this.socket.emit(
                "room:event",
                { event: event.toString(), data },
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
