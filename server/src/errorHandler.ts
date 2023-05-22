import { ZodError } from "zod";

export const errorHandler = (handler: any) => {
    const handleError = (
        err: any,
        response: (success: boolean, error: string) => void,
    ) => {
        if (response && typeof response === "function") {
            if (err instanceof ZodError) {
                const errors = err.issues.map((issue) => issue.message);
                response(false, errors[0] || "Unknown error.");
            } else {
                response(false, err?.toString() || "Unknown error.");
            }
        } else console.log(err);
    };

    return (...args: any[]) => {
        try {
            // @ts-ignore
            const ret = handler.apply(this, args);
            if (ret && typeof ret.catch === "function") {
                // async handler
                ret.catch(handleError);
            }
        } catch (e) {
            // sync handler
            handleError(e, args[args.length - 1]);
        }
    };
};
