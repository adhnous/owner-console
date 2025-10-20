'use server';

/**
 * @fileOverview AI-powered service title improvement flow.
 *
 * - improveServiceTitle - A function that suggests improvements to a service title.
 * - ImproveServiceTitleInput - The input type for the improveServiceTitle function.
 * - ImproveServiceTitleOutput - The return type for the improveServiceTitle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ImproveServiceTitleInputSchema = z.object({
  title: z.string().describe('The original service title.'),
  description: z.string().describe('The service description.'),
  category: z.string().describe('The service category.'),
});

export type ImproveServiceTitleInput = z.infer<typeof ImproveServiceTitleInputSchema>;

const ImproveServiceTitleOutputSchema = z.object({
  improvedTitle: z.string().describe('The improved service title suggestion.'),
});

export type ImproveServiceTitleOutput = z.infer<typeof ImproveServiceTitleOutputSchema>;

export async function improveServiceTitle(input: ImproveServiceTitleInput): Promise<ImproveServiceTitleOutput> {
  return improveServiceTitleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'improveServiceTitlePrompt',
  input: {schema: ImproveServiceTitleInputSchema},
  output: {schema: ImproveServiceTitleOutputSchema},
  prompt: `You are an AI assistant specializing in improving service titles to attract more clients.

  Given the following service details, suggest a better title that is more descriptive and likely to attract more clients. Focus on making the title clear, concise, and appealing.

  Category: {{{category}}}
  Original Title: {{{title}}}
  Description: {{{description}}}

  Improved Title:`,
});

const improveServiceTitleFlow = ai.defineFlow(
  {
    name: 'improveServiceTitleFlow',
    inputSchema: ImproveServiceTitleInputSchema,
    outputSchema: ImproveServiceTitleOutputSchema,
  },
  async input => {
    const {text} = await prompt(input);
    return { improvedTitle: text! };
  }
);
