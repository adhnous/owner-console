'use server';

/**
 * @fileOverview A service category auto-categorization AI agent.
 *
 * - autoCategorizeService - A function that handles the service auto-categorization process.
 * - AutoCategorizeServiceInput - The input type for the autoCategorizeService function.
 * - AutoCategorizeServiceOutput - The return type for the autoCategorizeService function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutoCategorizeServiceInputSchema = z.object({
  description: z
    .string()
    .describe('The description of the service to be categorized.'),
});
export type AutoCategorizeServiceInput = z.infer<
  typeof AutoCategorizeServiceInputSchema
>;

const AutoCategorizeServiceOutputSchema = z.object({
  categorySuggestions: z
    .array(z.string())
    .describe('An array of suggested categories for the service.'),
});
export type AutoCategorizeServiceOutput = z.infer<
  typeof AutoCategorizeServiceOutputSchema
>;

export async function autoCategorizeService(
  input: AutoCategorizeServiceInput
): Promise<AutoCategorizeServiceOutput> {
  return autoCategorizeServiceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'autoCategorizeServicePrompt',
  input: {schema: AutoCategorizeServiceInputSchema},
  output: {schema: AutoCategorizeServiceOutputSchema},
  prompt: `You are a service categorization expert.

  Given a service description, you will provide a list of suggested categories for the service.
  The categories should be relevant and specific to the service described.

  Service Description: {{{description}}}
  `,
});

const autoCategorizeServiceFlow = ai.defineFlow(
  {
    name: 'autoCategorizeServiceFlow',
    inputSchema: AutoCategorizeServiceInputSchema,
    outputSchema: AutoCategorizeServiceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
