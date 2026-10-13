// The words of the retrieval-layer diagram in CS-2's Actions section (Story
// 3.4, FR-36). Drawn from scratch from the case study's own prose: one
// question asked in two states, inside a temporary exception's window and
// after its expiry date, with nothing in the index changed. In each state
// both candidate sources pass three separate gates (relevant, authority, in
// force), and the answer inverts when only the calendar moves. Generic by
// rule: no service, system, product or employer is named, and no figure is
// given. It lives under content/ so the content review box gates every word.
// Not evidence: AD-6 governs Case Studies and Projects only, so
// components/case-study/retrieval-diagram.tsx imports this file directly.

// How a gate's answer is marked by its decorative glyph. The meaning is
// always in the answer's words; the glyph is aria-hidden.
export type GateMark = "pass" | "fail" | "outranks" | "outranked";

export type Gate = { readonly answer: string; readonly mark: GateMark };

export type Candidate = {
  readonly name: string;
  // What the source tells the assistant, as a sentence.
  readonly guidance: string;
  readonly relevant: Gate;
  readonly authority: Gate;
  readonly inForce: Gate;
  // Whether this candidate is the state's answer, and why, in words.
  readonly wins: boolean;
  readonly verdict: string;
};

export type DiagramState = {
  readonly heading: string;
  readonly candidates: readonly [Candidate, Candidate];
  // The winning guidance, in words, after the "Answer:" label.
  readonly answer: string;
};

const STANDARD = "The resilience standard";
const EXCEPTION = "A temporary exception for one service";

export const retrievalDiagram = {
  // The figcaption: the text alternative, rendered on the page.
  caption:
    "How the retrieval layer decides. One question, whether a failed call to one service may be retried, is asked twice: while a temporary exception to the resilience standard is in force, and after the exception's expiry date has passed, with nothing in the index changed. Each time, both sources pass through three separate gates. Relevance says whether a source bears on the question, authority says which source wins when relevant sources conflict, and expiry says whether a source is still in force. While the exception is in force it outranks the standard, so the answer is not to retry. Once it has expired it can no longer win, so the same index answers that retries are allowed. Only the date has moved.",
  question: "The question: may a failed call to this one service be retried?",
  gates: { relevant: "Relevant", authority: "Authority", inForce: "In force" },
  answerLabel: "Answer:",
  states: [
    {
      heading: "While the exception is in force",
      candidates: [
        {
          name: STANDARD,
          guidance: "Retries are allowed.",
          relevant: { answer: "Yes", mark: "pass" },
          authority: { answer: "Outranked by the exception", mark: "outranked" },
          inForce: { answer: "Yes", mark: "pass" },
          wins: false,
          verdict: "Not the answer. It is relevant and in force, but a source that outranks it is in force too.",
        },
        {
          name: EXCEPTION,
          guidance: "Do not retry this service.",
          relevant: { answer: "Yes", mark: "pass" },
          authority: { answer: "Outranks the standard", mark: "outranks" },
          inForce: { answer: "Yes, until its expiry date", mark: "pass" },
          wins: true,
          verdict: "The answer. It is relevant, it outranks the standard, and it is in force.",
        },
      ],
      answer: "Do not retry this service, from the temporary exception.",
    },
    {
      heading: "After the exception has expired, with the index unchanged",
      candidates: [
        {
          name: STANDARD,
          guidance: "Retries are allowed.",
          relevant: { answer: "Yes", mark: "pass" },
          authority: { answer: "Outranked by the exception", mark: "outranked" },
          inForce: { answer: "Yes", mark: "pass" },
          wins: true,
          verdict: "The answer. It is relevant and in force, and the only source that outranks it is no longer in force.",
        },
        {
          name: EXCEPTION,
          guidance: "Do not retry this service.",
          relevant: { answer: "Yes", mark: "pass" },
          authority: { answer: "Outranks the standard", mark: "outranks" },
          inForce: { answer: "No, its expiry date has passed", mark: "fail" },
          wins: false,
          verdict: "Not the answer. It is still relevant and still outranks the standard, but it is no longer in force.",
        },
      ],
      answer: "Retries are allowed, from the resilience standard.",
    },
  ] as const satisfies readonly [DiagramState, DiagramState],
  // What similarity alone would return, in both states.
  similarityAlone:
    "Similarity alone would return the temporary exception in both states, because it names the service, the pattern and the reasoning: right while it is in force, and wrong once it has expired.",
} as const;
