---
name: daily-digest-brief
description: Guidelines for editing the Daily Digest brief at .claude/commands/daily-digest.md. Use whenever adding, rewriting, or removing a rule, an example, or a section in that file — including when fixing a defect found in a published edition. Encodes the Claude Fable 5.1 prompting guidance the brief is tuned for: reach for an example before a rule, describe success instead of enumerating failure, and what must not be deleted. Not for writing or researching an edition; that is the brief's own job.
---

# Editing the Daily Digest brief

The brief is a prompt, not documentation. Every line is read by the model that writes the letter, so
an edit is a behavioural change with no test suite in front of it. These are the rules that have
actually held up across the edits in this repo's history.

## The model, and where its style instructions live

The brief is tuned for **Claude Fable 5.1** (commit `0357cf7`). Two properties of that model shape
everything below.

It follows instructions closely and literally, which means over-specification costs quality rather
than buying it. Anthropic's own migration guidance is explicit: prompts written for prior models are
often too prescriptive for Fable 5.1 and *reduce* output quality. State the goal and the constraints;
don't enumerate the steps.

The brief is a slash command, so its whole text arrives as the first user turn of the run. Style
instructions hold better there than in a system prompt, which is why the mannered-prose section
works where it is. **Don't move style guidance out of the brief**, and don't assume a rule failed
because of where it sits.

## Start from a defect, not a hunch

Before changing a line, quote the sentence in a published edition that went wrong, then name the line
in the brief that permitted it. A rule that can't be traced to a real letter is a rule nobody asked
for, and the next editor won't be able to tell whether it is load-bearing.

The corollary: an edit that finds nothing should change nothing. A clean pass is a valid outcome.

## Reach for an example before a rule

Concrete examples are the strongest signal in a prompt — the model matches their length, tone and
structure far more reliably than it obeys a prohibition. This repo has the experiment on record.

`a5480af` ("Unbundle the letter") fixed both the rules and the two `<examples>` that had been
demonstrating the bundling defect as the model answer. It merged about ten hours before the 09-08 run.
It worked exactly as far as its examples reached: the "from the dev lists" bundle was gone and the
closing list came back one story per line. What survived were the two shapes no example covered — a
`## Around here` header collecting unrelated local stories, and one closing line carrying two.

So when a rule is being ignored, the first question is not "how do I say this more firmly" but "does
an example show it". And check the `<examples>` block for the defect itself: the letter's
"Same issue." back-references were being taught by a `<good>` block that ended with one.

Examples are also the fix Anthropic recommends for the specific failure of reproducing source text
without marking it as quotation — one complete correct response, with a line saying why it is correct.
That is the `<bad>` / `<good>` / `<why>` shape already in use. Keep it.

## Describe success; don't enumerate failure

A prohibition against a failure the model wasn't going to make can anchor it toward that failure, and
a run of them flattens priority so that none of them carries weight. Prefer the positive statement of
what the letter does.

Keep a prohibition where the failure demonstrably reproduces and the reason travels with it. The
"Never write about the newsletter" list earns its place on exactly that basis — the failure recurs in
edition after edition. Don't clear it out on principle; that is the one way this kind of edit makes
things worse.

## Two shapes that are cruft on this model

**Anti-formatting language.** Fable 5.1 under-formats by default — fewer headers, less bold, fewer
lists than earlier models. A rule phrased as "never use headers" strips structure the reader wanted.
Say when formatting is right instead: every entry carries a headline, and no header groups entries.

**Numeric output ceilings.** Word counts and "at most N" clamps read as caps that starve reasoning.
`a5480af` removed the brief's word counts for that reason while keeping every depth tier and
paragraph range, which are the shape of the letter rather than a budget. Re-express a ceiling as the
outcome it was protecting; don't delete a genuine product constraint because it contains a number.

## What not to delete

Length is not the enemy, and a shortening pass deletes exactly the highest-value words.

- **Context is never cruft.** The audience, the quality bar, the reasons behind a constraint — what
  only the author knows — stays. A too-short brief produces generic output.
- **Prohibitions against demonstrated failures stay.**
- **Working redundancy stays.** The same idea in a rule and an example is not duplication to
  consolidate; it is the rule and its strongest carrier. Propose a merge only where the two disagree.
- **Format-pinning examples stay.**

Never justify a cut by character count alone.

## The verifier boundary

The pre-publish sub-agent keeps the checks a fresh reader is genuinely better at: where the letter
talks about its own production, and which entries carry no concrete fact. Both are judgments made
from the letter text alone.

`c4cde86` removed a link check from it and the reasoning still holds. Cross-referencing the letter's
links against the URL ledger is a set difference, not judgment — it scales with a ledger of hundreds
of URLs and its false positives were binding, so each one forced a good link to be cut. Provenance
checks belong with the lead, the only participant holding both the ledger and the tool results.

Before adding a question to the verifier, ask which kind it is. If it needs the run's context, it is
the lead's. If the writer's own ear is the instrument — prose rhythm, a repeated headline shape — a
fresh reader won't catch it either.

## An edit is a hypothesis

Nothing here can be verified without a run. Make the change, then read the next edition against it.
If a cut regresses, re-add the instruction in its minimal form rather than restoring the verbose
original. Prefer replacing prose over appending to it: if the file grows every time, the edits have
become rule-piling, which is the failure this file exists to prevent.
