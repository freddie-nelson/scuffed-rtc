import { z } from "zod";

export const generateId = (length: number) => {
    let id = "";

    while (id.length < length) {
        id += Math.random().toString(36).slice(2);
    }

    return id.slice(0, length);
};

const idSchema = z
    .string()
    .min(1)
    .max(12)
    .regex(/^[a-z0-9]+$/, "Id must be alphanumeric.");
export const validateId = (id: string) => {
    return idSchema.parse(id);
};
