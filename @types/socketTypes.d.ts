export interface ServerToClientEvents {
  "room:update": (room: ClientRoom, serverTime: number) => void;
  "room:event": (eventInfo: { event: string; data: string; sender: string; serverTime: number }) => void;
}

export interface RoomOptions {
  maxConnections: number;
  public: boolean;
  meta?: {
    [key: string]: any;
  };
}

export interface Room<M> {
  id: string;
  host: M;
  members: M[];
  opts: RoomOptions;
}

export type ClientRoom = Room<string>;

export interface ClientToServerEvents {
  "namespace:join": (namespace: string, response: (success: boolean, error?: string) => void) => void;
  "namespace:get-public-rooms": (
    response: (success: boolean, roomsOrError?: string | ClientRoom[]) => void
  ) => void;

  "room:create": (
    id: string,
    options: Partial<RoomOptions>,
    response: (success: boolean, roomOrError: string | ClientRoom) => void
  ) => void;
  "room:join": (id: string, response: (success: boolean, roomOrError: string | ClientRoom) => void) => void;
  "room:leave": (response: (success: boolean, error?: string) => void) => void;
  "room:event": (
    eventInfo: { event: string; data: any },
    response: (success: boolean, error?: string) => void
  ) => void;
}

export interface InterServerEvents {}

export interface SocketData {}
