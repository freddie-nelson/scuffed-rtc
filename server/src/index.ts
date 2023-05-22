import { createServer } from "http";
import { Server as SocketServer, ServerOptions, Socket } from "socket.io";
import {
    ClientRoom,
    ClientToServerEvents,
    InterServerEvents,
    Room,
    RoomOptions,
    ServerToClientEvents,
    SocketData,
} from "../../@types/socketTypes";
import { z } from "zod";
import { validateId } from "./id";
import { errorHandler } from "./errorHandler";

type TypedSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

type ServerRoom = Room<TypedSocket>;

type Rooms = Map<string, ServerRoom>;

interface Client {
    namespace: string;
    room: ServerRoom | null;
}

export const serverRoomToClientRoom = (room: ServerRoom): ClientRoom => {
    return {
        id: room.id,
        host: room.host?.id,
        members: room.members.map((member) => member.id),
        opts: room.opts,
    };
};

export default class Server {
    protected io: SocketServer | null = null;

    protected clients: Map<TypedSocket, Client> = new Map();

    protected namespaces: Map<string, TypedSocket[]> = new Map();
    protected namespaceRooms: Map<string, Rooms> = new Map();

    MAX_ROOM_CONNECTIONS = 1000;
    private roomOptionsSchema = z
        .object({
            maxConnections: z
                .number()
                .int()
                .min(1)
                .max(this.MAX_ROOM_CONNECTIONS)
                .default(this.MAX_ROOM_CONNECTIONS),
        })
        .required();

    constructor(namespaces: string[] = []) {
        if (namespaces.length === 0) throw new Error("No namespaces provided.");

        for (const namespace of namespaces) {
            this.namespaces.set(namespace, []);
            this.namespaceRooms.set(namespace, new Map());
        }
    }

    start(port: number, opts: Partial<ServerOptions> = {}) {
        const httpServer = createServer();
        this.io = new SocketServer<
            ClientToServerEvents,
            ServerToClientEvents,
            InterServerEvents,
            SocketData
        >(httpServer, opts);

        this.addIoListeners();

        return new Promise<void>((resolve, reject) => {
            httpServer.listen(port, () => {
                resolve();
            });
        });
    }

    private addIoListeners() {
        if (!this.io) throw new Error("Server is not started.");

        this.io.on("connection", this.onConnection.bind(this));
    }

    private onConnection(socket: TypedSocket) {
        const client: Client = { namespace: "", room: null };
        this.clients.set(socket, client);

        // inter-server events
        socket.on("disconnect", () => {
            if (client.room) this.leaveRoom(socket);
            if (client.namespace) this.leaveNamespace(socket);

            this.clients.delete(socket);
        });

        // namespace events
        socket.on(
            "namespace:join",
            errorHandler(((namespace, response) => {
                this.joinNamespace(socket, namespace);
                response(true);
            }) as ClientToServerEvents["namespace:join"]),
        );

        // room events
        socket.on(
            "room:create",
            errorHandler(((id, options, response) => {
                if (client.room) throw new Error("Already in a room.");

                const rooms = this.getAccessibleRooms(socket);
                if (rooms.has(id)) throw new Error("Id is already taken.");

                id = validateId(id);
                options = this.roomOptionsSchema.parse(options);

                const room: ServerRoom = {
                    id,
                    host: socket,
                    members: [],
                    opts: options as RoomOptions,
                };
                rooms.set(id, room);

                this.joinRoom(socket, room);

                response(true, serverRoomToClientRoom(room));
            }) as ClientToServerEvents["room:create"]),
        );

        socket.on(
            "room:join",
            errorHandler(((id, response) => {
                if (client.room) throw new Error("Already in a room.");

                id = validateId(id);

                const rooms = this.getAccessibleRooms(socket);
                if (!rooms.has(id)) throw new Error("Room does not exist.");

                const room = rooms.get(id)!;
                this.joinRoom(socket, room);

                response(true, serverRoomToClientRoom(room));
            }) as ClientToServerEvents["room:join"]),
        );

        socket.on(
            "room:leave",
            errorHandler(((response) => {
                if (!client.room) throw new Error("Not in a room.");

                this.leaveRoom(socket);

                response(true);
            }) as ClientToServerEvents["room:leave"]),
        );

        socket.on(
            "room:event",
            errorHandler((({ event, data }, response) => {
                if (!client.room) throw new Error("Not in a room.");

                const room = client.room;
                for (const member of room.members) {
                    member.emit("room:event", {
                        event,
                        data,
                        sender: socket.id,
                        serverTime: Date.now(),
                    });
                }

                response(true);
            }) as ClientToServerEvents["room:event"]),
        );
    }

    private isValidNamespace(namespace: string) {
        return this.namespaces.has(namespace);
    }

    private joinNamespace(socket: TypedSocket, namespace: string) {
        if (this.clients.get(socket)?.namespace)
            throw new Error("Already in a namespace.");

        if (!this.isValidNamespace(namespace))
            throw new Error("Invalid namespace.");

        socket.join(namespace);
        this.namespaces.get(namespace)?.push(socket);

        this.clients.get(socket)!.namespace = namespace;
    }

    private leaveNamespace(socket: TypedSocket) {
        const client = this.clients.get(socket);
        if (!client) throw new Error("Client does not exist.");

        const namespace = client.namespace;
        if (!namespace) throw new Error("Not in a namespace.");

        const namespaceSockets = this.namespaces.get(namespace);
        if (!namespaceSockets) throw new Error("Namespace does not exist.");

        const i = namespaceSockets.indexOf(socket);
        if (i === -1) throw new Error("Socket not in namespace.");

        namespaceSockets.splice(i, 1);
        client.namespace = "";

        socket.leave(namespace);
    }

    private getAccessibleRooms(socket: TypedSocket) {
        const { namespace } = this.clients.get(socket)!;

        if (!namespace) throw new Error("Not in a namespace.");
        if (!this.namespaceRooms.has(namespace))
            throw new Error("Namespace does not exist.");

        return this.namespaceRooms.get(namespace)!;
    }

    private joinRoom(socket: TypedSocket, room: ServerRoom) {
        if (room.members.length >= room.opts.maxConnections)
            throw new Error("Room is full.");

        const client = this.clients.get(socket);
        if (!client) throw new Error("Client does not exist.");

        room.members.push(socket);
        client.room = room;

        this.updateRoom(room);
    }

    private leaveRoom(socket: TypedSocket) {
        const client = this.clients.get(socket);
        if (!client) throw new Error("Client does not exist.");

        const room = client.room;
        if (!room) throw new Error("Not in a room.");

        const i = room.members.indexOf(socket);
        if (i === -1) throw new Error("Client is not in the room.");

        room.members.splice(i, 1);
        client.room = null;

        if (room.host === socket) {
            room.host = room.members[0] || {};
        }

        if (room.members.length === 0) {
            const rooms = this.getAccessibleRooms(socket);
            rooms.delete(room.id);
        }

        this.updateRoom(room);
    }

    private updateRoom(room: ServerRoom) {
        const clientRoom = serverRoomToClientRoom(room);

        for (const member of room.members) {
            member.emit("room:update", clientRoom, Date.now());
        }
    }
}