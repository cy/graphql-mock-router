import dotenv from "dotenv";
import express from "express";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { Logger } from "./Logger";
import { objectToString, stringToObject } from "./formatter";
import { validateAndCorrectAiResponse } from "./validateAndCorrectAiResponse";
import { SubgraphValidator } from "./validator/SubgraphValidator";
import { promises as fs } from "fs";
import { Supergraph } from "@apollo/federation-internals";
import { SubgraphValidators } from "./types";
import { parse, print } from "graphql";

const subgraphValidators: SubgraphValidators = new Map();

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());

app.post("/", async (req, res) => {
  const {
    serviceName,
    id,
    version,
    stage,
    body: { query, variables },
  } = req.body;

  // const normalizedQuery = addTypenameToDocument(query);
  const normalizedQuery = print(parse(query));

  const logger = new Logger(serviceName, id);

  logger.logStart("Subgraph Request");

  try {
    // const model = google('models/gemini-1.5-pro-latest');
    //const model = google('models/gemini-pro');
    const model = google("models/gemini-1.5-flash");

    let promptVariables = "";
    if (variables) {
      promptVariables = `

With variables:
\`\`\`json
${objectToString(variables)}
\`\`\``;
    }

    const prompt = `Give me mock data that fulfills this query:
\`\`\`graphql
${normalizedQuery}
\`\`\`${promptVariables}`;

    logger.log("💬 Prompt:", prompt);

    const { text, finishReason, usage, warnings } = await generateText({
      model,
      prompt,
    });

    const json = stringToObject(text);

    logger.log("📝 JSON:", objectToString(json));

    let responseBody = await validateAndCorrectAiResponse(
      json,
      serviceName,
      model,
      subgraphValidators,
      normalizedQuery,
      logger
    );

    if (!responseBody.data) {
      responseBody = {
        data: responseBody,
      };
    }

    if (json) {
      res.json({
        version,
        stage,
        control: { break: 200 },
        body: responseBody,
      });
      return;
    }

    res.json({
      version,
      stage,
      control: { break: 500 },
      body: {
        errors: ["Failed to generate a result."],
      },
    });
    return;
  } catch (error) {
    logger.log("Encountered error:", error);

    res.json({
      version,
      stage,
      control: { break: 500 },
      body: {
        errors: [error],
      },
    });
  }
});

app.listen(port, async () => {
  const supergraphSchema = await fs.readFile("supergraph-schema.graphql", {
    encoding: "utf-8",
  });
  const supergraph = Supergraph.build(supergraphSchema);
  const subgraphs = supergraph.subgraphs();
  subgraphs.values().forEach(({ name, schema }) => {
    subgraphValidators.set(name, new SubgraphValidator(schema.toAST()));
  });
  console.log(`✅ Supergraph schema loaded`);
  console.log(`🚀 Coprocessor running on port ${port}`);
});
