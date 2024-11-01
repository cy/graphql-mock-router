import { google } from '@ai-sdk/google';
import { SubgraphValidator } from './validator/SubgraphValidator';

export type GenericObject = { [key: string]: any };
export type GoogleGenerativeAILanguageModel = ReturnType<typeof google>;
export type SubgraphValidators = Map<string, SubgraphValidator>;
