import dotenv from 'dotenv';
import express from 'express';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());

app.post('/', async (req, res) => {
  const {
    serviceName,
    id,
    version,
    stage,
    body: { query, variables },
  } = req.body;

  console.log('\n\n');
  console.log('############################################################');
  console.log('Subgraph Request:', serviceName, id);

  try {
    // const model = google('models/gemini-1.5-pro-latest');
    const model = google('models/gemini-pro');

    let promptVariables = '';
    if (variables) {
      promptVariables = `

        With variables:
        ${JSON.stringify(variables)}`;
    }

    const prompt = `Give me mock data consistent with [Website/Company] that fulfills this query:
      ${query}
      ${promptVariables}

      Price amount is a string.`;

    console.log('\n', serviceName, 'Prompt:', prompt);

    const { text, finishReason, usage, warnings } = await generateText({
      model,
      prompt,
    });

    console.log('\n', serviceName, 'text:', text);

    const jsonText = text.replace(/\n?```([a-z]+)?\n?/gi, '');

    const json = JSON.parse(jsonText);
    console.log('\n', serviceName, 'json:', JSON.stringify(json, null, 2));

    let responseBody = json;
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
        errors: ['Failed to generate a result.'],
      },
    });
    return;
  } catch (error) {
    console.log('\n', serviceName, error);
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

app.listen(port, () => {
  console.log(`🚀 Coprocessor running on port ${port}`);
});
