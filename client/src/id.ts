export const generateId = (length: number) => {
    let id = "";

    while (id.length < length) {
        id += Math.random().toString(36).slice(2);
    }

    return id.slice(0, length);
};
