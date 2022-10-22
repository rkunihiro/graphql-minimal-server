import { buildASTSchema } from "graphql";
import { gql } from "graphql-tag";

export const schema = buildASTSchema(gql`
    type Query {
        message: String!
    }
`);
