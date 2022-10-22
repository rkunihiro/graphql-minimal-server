import { createServer, IncomingMessage, ServerResponse } from "node:http";

import { graphql, GraphQLArgs } from "graphql";

import { rootValue } from "./rootValue";
import { schema } from "./schema";

async function readBody(req: IncomingMessage) {
    return new Promise<string>((resolve, reject) => {
        let body = "";
        req.on("data", (chunk: string) => {
            body += chunk;
        });
        req.on("end", () => {
            resolve(body);
        });
        req.on("error", (err: Error) => {
            reject(err);
        });
    });
}

interface GraphQLRequestBody {
    query: string;
    variables: GraphQLArgs["variableValues"];
}

async function readGraphQLRequestBody(req: IncomingMessage): Promise<GraphQLRequestBody> {
    try {
        const contentType = req.headers["content-type"] as string;
        if (!/^application\/json/.test(contentType)) {
            throw new BadRequestError("Invalid content-type");
        }
        const body = await readBody(req);
        const json = JSON.parse(body);
        if (typeof json.query !== "string") {
            throw new BadRequestError("Invalid request body: field 'query' is required");
        }
        return json;
    } catch (err) {
        throw new BadRequestError(`Invalid request body: ${err}`);
    }
}

function writeResponse(res: ServerResponse, code: number, message: string): void {
    res.writeHead(code, message, { "content-type": "text/plain;charset=UTF-8" });
    res.end(`${message}\n`);
}

const endpointPath = "/graphql";

class BadRequestError extends Error {}

export async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
        const { method, url = "" } = req;
        const { pathname } = new URL(url, `http://${req.headers.host}`);

        if (pathname !== endpointPath) {
            return writeResponse(res, 404, "Not Found");
        }

        if (method === "OPTIONS") {
            // preflight response
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "*");
            res.setHeader("Access-Control-Allow-Headers", "*");
            res.setHeader("Access-Control-Max-Age", "600");
            return writeResponse(res, 204, "No Content");
        }

        if (method !== "POST") {
            return writeResponse(res, 405, "Method Not Allowed");
        }

        // Parse GraphQL args
        const { query, variables } = await readGraphQLRequestBody(req);
        console.log("GraphQL request", { query, variables });

        // Resolve GraphQL request
        const result = await graphql({
            schema,
            rootValue,
            source: query,
            variableValues: variables,
        });

        // Response GraphQL result
        res.writeHead(200, "OK", { "content-type": "application/json;charset=UTF-8" });
        res.end(JSON.stringify(result) + "\n");
    } catch (err) {
        console.warn(err);
        if (err instanceof BadRequestError) {
            return writeResponse(res, 400, "Bad Request");
        }
        return writeResponse(res, 500, "Internal Server Error");
    }
}

export async function main(port = 3000, hostname = "localhost") {
    const server = createServer(handler);
    server.listen(port, hostname);
    console.log(`Start GraphQL server http://${hostname}:${port}${endpointPath}`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
