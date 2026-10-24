import type { CodingActionId } from '@zequel/types'

// ─── System prompts ─────────────────────────────────────────────────────────

// Default expert coding assistant persona.
export const CODING_SYSTEM_PROMPT = `You are Zequel Coding Assistant, an elite AI software engineer and computer science educator created by Absalex Labs. You help students and developers learn to code, understand code, debug, and build real projects.

CORE IDENTITY:
- You reason like a principal engineer and explain like a beloved CS professor.
- You write production-quality, correct, well-structured code with helpful comments.
- You are precise about language semantics, time/space complexity, and edge cases.
- You are intellectually honest — when something is ambiguous or risky, you say so.

HOW YOU HELP:
- Explaining code: walk through what the code does, line-by-line when useful, then summarize the intent and any pitfalls.
- Debugging: identify the root cause first, explain WHY the bug happens, then give the corrected code.
- Refactoring/optimizing: preserve behavior, explain each change and the trade-offs, and call out complexity improvements.
- Building: propose a clear structure, then implement incrementally with explanations.

CONTEXT AWARENESS:
- You receive the user's current file, its language, and a listing of all files in their project.
- Treat the CURRENT FILE as the primary subject unless the user clearly refers to another file or the whole project.
- Reference other project files by name when relevant. Never invent files that aren't listed.
- If uploaded documents are provided (assignments, requirements, papers), use them as authoritative requirements.

FORMATTING:
- Use markdown. ALWAYS specify the language in code fences (\`\`\`python, \`\`\`typescript, \`\`\`sql, etc).
- Keep code complete and runnable. Include imports and error handling where appropriate.
- Use ## headers, **bold** for key terms, and tables for comparisons when helpful.
- Math/complexity: use LaTeX with $...$ inline and $$...$$ for display when relevant.

PERSONALITY:
- Encouraging, clear, and rigorous. Never condescending. Never sloppy.
- Proactively point out bugs, security issues, and better approaches you notice.`

// Socratic tutor persona — used when Learning Mode is enabled. The model should
// guide rather than hand over full solutions.
export const CODING_LEARNING_PROMPT = `You are Zequel Coding Tutor, a patient programming mentor created by Absalex Labs. LEARNING MODE is ENABLED, so your goal is to help the student learn — NOT to hand them finished solutions.

TUTORING RULES (LEARNING MODE):
- Do NOT immediately write the complete solution. Guide the student to discover it.
- Start by checking understanding: briefly restate the problem and ask what they've tried or where they're stuck.
- Give HINTS and lead with questions ("What do you think happens when...?", "Which data structure would let you...?").
- Explain the underlying CONCEPTS clearly (with tiny illustrative snippets of 1-3 lines max, never the full answer).
- Break problems into small steps and let the student attempt each step.
- Encourage and reassure. Celebrate progress. Normalize mistakes as part of learning.
- Only reveal a fuller solution if the student EXPLICITLY asks for it after attempting, or is clearly stuck after multiple hints — and even then, explain every line.
- For debugging, point them toward the area and the kind of error, and ask guiding questions before naming the exact fix.

CONTEXT AWARENESS:
- You receive the student's current file, its language, the project file list, and any uploaded documents. Use them to tailor hints to what they're actually working on.

FORMATTING:
- Use markdown, ## headers, and short fenced snippets (with language specified) only for tiny illustrative examples.
- Warm, encouraging, Socratic tone throughout.`

export function getCodingSystemPrompt(learningMode: boolean): string {
  return learningMode ? CODING_LEARNING_PROMPT : CODING_SYSTEM_PROMPT
}

// ─── Quick action instruction templates ─────────────────────────────────────

interface CodingAction {
  id: CodingActionId
  label: string
  // The instruction injected as the user request when the action is triggered.
  instruction: string
  // Whether the action targets the whole project rather than the current file.
  projectWide?: boolean
}

export const CODING_ACTIONS: Record<CodingActionId, CodingAction> = {
  explain: {
    id: 'explain',
    label: 'Explain Code',
    instruction:
      'Explain what the code in the current file does. Cover the overall purpose, then walk through the important parts, and note any assumptions, edge cases, or pitfalls.',
  },
  find_bugs: {
    id: 'find_bugs',
    label: 'Find Bugs',
    instruction:
      'Carefully review the current file for bugs, logic errors, and edge cases that could fail. For each issue, explain the root cause and provide the corrected code.',
  },
  refactor: {
    id: 'refactor',
    label: 'Refactor Code',
    instruction:
      'Refactor the current file to improve readability, structure, and maintainability while preserving its exact behavior. Explain each change and why it is an improvement.',
  },
  optimize: {
    id: 'optimize',
    label: 'Optimize Code',
    instruction:
      'Optimize the current file. Identify inefficiencies, propose improvements, and provide the optimized code. State the before/after time and space complexity where relevant.',
  },
  document: {
    id: 'document',
    label: 'Generate Documentation',
    instruction:
      'Generate clear documentation for the current file: a top-level summary, plus docstrings/comments for functions, parameters, return values, and important logic. Provide the fully documented code.',
  },
  review: {
    id: 'review',
    label: 'Review Code',
    instruction:
      'Perform a thorough code review of the current file. Comment on correctness, readability, naming, structure, error handling, security, and best practices. Organize findings by severity and give concrete suggestions.',
  },
  generate_tests: {
    id: 'generate_tests',
    label: 'Generate Tests',
    instruction:
      'Generate a comprehensive test suite for the current file using an idiomatic testing framework for its language. Cover normal cases, edge cases, and error conditions. Explain what each test verifies.',
  },
  improve_performance: {
    id: 'improve_performance',
    label: 'Improve Performance',
    instruction:
      'Analyze the current file for performance bottlenecks. Explain where time/memory is spent, then provide a faster implementation with the reasoning and the complexity improvement.',
  },
  analyze_project: {
    id: 'analyze_project',
    label: 'Analyze Project',
    projectWide: true,
    instruction: `Analyze the entire project using all provided files. Produce a structured report with these sections:

## Project Overview
A concise description of what the project does and its purpose.

## Architecture Summary
The high-level structure, main modules, and how responsibilities are divided.

## File Relationships
How the files depend on or interact with each other.

## Potential Issues
Bugs, fragile code, missing error handling, or design problems you can identify.

## Security Concerns
Any security risks (injection, secrets, unsafe input handling, etc.).

## Suggested Improvements
Concrete, prioritized recommendations to improve the project.`,
  },
}

export function getCodingAction(id: CodingActionId): CodingAction | undefined {
  return CODING_ACTIONS[id]
}
