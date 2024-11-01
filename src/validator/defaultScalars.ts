import { Kind } from 'graphql';
import { z } from 'zod';

export type DefaultScalars = {
  String: any;
  Int: any;
  Boolean: any;
  Float: any;
  ID: any;
};

export const defaultScalars: DefaultScalars = {
  String: z.coerce.string(),
  Int: z.coerce.number(),
  Boolean: z.coerce.boolean(),
  Float: z.coerce.number(),
  ID: z.coerce.string(),
};
