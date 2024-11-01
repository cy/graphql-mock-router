import { generateText } from 'ai';
import { Logger } from './Logger';
import { objectToString, stringToObject } from './formatter';
import {
  GenericObject,
  GoogleGenerativeAILanguageModel,
  SubgraphValidators,
} from './types';

/**
 *
 * @param obj
 * @param serviceName
 * @param model
 * @param logger
 * @param attempts
 * @returns
 */
export async function validateAndCorrectAiResponse(
  response: GenericObject,
  serviceName: string,
  model: GoogleGenerativeAILanguageModel,
  subgraphValidators: SubgraphValidators,
  query: string,
  logger: Logger,
  attempts = 0,
): Promise<GenericObject> {
  if (attempts > 1 || !subgraphValidators.has(serviceName)) {
    return response;
  }

  // Sometimes the agent sends back the object with a `data` property,
  // sometimes it does not. We'll account for that by grabbing the contents
  // of `data` if it is present.
  const normalizedResponse = response.data ?? response;

  logger.log('👀 Validating result:', objectToString(normalizedResponse));

  // Get the subgraph validator
  const subgraphValidator = subgraphValidators.get(serviceName);

  // Create a validator tailored to the operation being performed
  const operationValidator = subgraphValidator.getOperationValidator(query);

  // Validate the result of the operation
  const validatedResponseBody =
    operationValidator.safeParse(normalizedResponse);

  logger.log('Validation result:', objectToString(validatedResponseBody));

  if (validatedResponseBody.success) {
    logger.log(
      '✅ Validation passed! Using validated result:',
      objectToString(validatedResponseBody.data),
    );
    return normalizedResponse;
  }

  logger.log('❌ Validation failed...');

  const correctionPrompts = validatedResponseBody.error?.issues?.map(
    (issue) => {
      return `${issue.path.join('.')} is the wrong type. ${issue.message}.`;
    },
  );

  if (!correctionPrompts.length) {
    logger.log('🤷 No issued found. Using the current results.');
    return normalizedResponse;
  }

  const correctionPrompt = `Return this data:
\`\`\`json
${objectToString(normalizedResponse)}
\`\`\`

with the following errors fixed:
${correctionPrompts.join('\n')}`;

  logger.log('💬 Correction prompt:', correctionPrompt);

  const {
    text: correctedText,
    finishReason,
    usage,
    warnings,
  } = await generateText({
    model,
    prompt: correctionPrompt,
  });

  const correctedJson = stringToObject(correctedText);

  logger.log('📝 Corrected JSON:', objectToString(correctedJson));

  // Validate and correct (if applicable) the corrected response
  return validateAndCorrectAiResponse(
    correctedJson,
    serviceName,
    model,
    subgraphValidators,
    query,
    logger,
    attempts + 1,
  );
}
