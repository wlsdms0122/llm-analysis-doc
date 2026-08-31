# Writing an analysis

How to work out what goes in the document, how to arrange it, and what to write it like. The syntax is `SYNTAX.md`. This document never repeats it.

An analysis document exists so that a reader arrives at your conclusion without repeating your work. That is the whole test. If the reader has to go and check the code to believe you, the document did not carry the analysis, it only announced it.

## The question comes first

Write the question at the top before you write anything else, in the form you were actually asked it. "Why does registration fail on a reinstall" is a question. "Registration analysis" is a subject heading, and a document under one drifts, because there is nothing it can be finished against.

A question you were given loosely is worth sharpening before you start. "Look into the sign flow" becomes "which step of the sign flow is the 400 coming from, and is it ours". Sharpening it is part of the analysis, and the sharpened form goes in the document. The reader who asked the loose question needs to see which one you answered.

If the work splits into several questions, they are several documents, or several `##` sections each with its own conclusion. What does not work is one conclusion covering three questions, because the reader cannot tell which evidence belongs to which.

## Evidence

**Every claim carries a coordinate.** A file and line, an API path, a log line, a version, a measured number. A sentence with no coordinate is an impression, and it reads exactly like a sentence that has one, so the reader cannot sort them.

```
The token is dropped before the retry (SessionStore.swift:214).
The token is dropped before the retry.
```

The second one might be true. Nobody can check it without redoing the work.

**Separate what you saw from what you concluded.** Three grades, and they need to stay visibly apart:

| grade | what it means |
|---|---|
| observed | you ran it, read it, or measured it |
| inferred | it follows from what you observed, and you can say from what |
| unchecked | plausible, and you did not go and look |

Inference is not a weaker kind of observation. It is a different thing, and the reader needs to know which links in the chain are which, because that is where they will disagree with you. Anything unchecked belongs in the open questions section, never in a paragraph next to observed facts.

**An absence needs its search.** "Nothing else writes to this key" is a claim about everything you did not read. Say how you looked: the grep, the call hierarchy, the scope you covered. Without that the reader has to take the absence on trust, and absences are where analyses are wrong most often.

**Measure rather than estimate.** Size, timing, counts, frequency. If you write a number you did not measure, say that you did not measure it. An estimate stated plainly is useful. An estimate that reads like a measurement is a defect in the document.

**A reproduction beats a description.** If you can give the steps, the request, or the input that produces the behaviour, that is worth more than any paragraph explaining it. Put it early.

## The shape of the document

**The first section is the conclusion.** One or two sentences, no preamble, no method. The reader decides from the first screen whether they need the rest, and a document that makes them read to the end for the answer wastes everyone who only needed the answer.

After that:

1. **Conclusion.** What is true, and what it means for the reader.
2. **The question.** What was asked, sharpened, and what you took to be in scope.
3. **What happens.** The mechanism, in the order it happens, with coordinates.
4. **Why it happens.** The cause, separated from the mechanism. These are different sections because a reader often accepts one and argues with the other.
5. **Options, if the reader has to choose.** What each one costs and what it gives up.
6. **Open questions and decisions.** Everything unchecked, and everything that needs someone else's call.

Skip the ones that do not apply. Do not reorder them. The order is what lets a reader stop reading at any point and still have the most useful thing they could have had by then.

**One section, one claim.** If the `##` heading cannot be written as a statement, the section is holding more than one thing. Headings that state something ("The retry reuses the expired token") beat headings that name a topic ("Retry logic"), because the contents page then reads as a summary.

**Analysis and judgement do not mix.** The analysis says what is true. Deciding what to do about it is often somebody else's, and the moment a recommendation sits inside a paragraph of evidence, the reader cannot accept the evidence and reject the recommendation. Keep the asks at the end, one per line, each saying who has to answer it.

## Choosing a component

The components exist because some shapes of content cost the reader real effort as prose. Reach for one when the content has that shape, not to decorate.

| the content is | use | why |
|---|---|---|
| a path through a system, with branches | ` ```mermaid graph ` | it also lands on the flow canvas, and the reader gets the whole terrain in one screen |
| two things being compared, point for point | `:::compare` | as prose the reader has to build the table in their head |
| an ordered procedure someone will follow | `:::steps` | the ordering becomes the structure rather than a claim about it |
| a call sequence across components | ` ```trace ` | who calls whom is the content, and prose buries it in verbs |
| a warning that changes what the reader should do | `:::warn` or `:::danger` | it survives skimming, which an inline sentence does not |
| a fixed set of attributes across cases | a plain table | |
| anything else | prose | |

Two traps. A diagram that only restates the sentence above it costs the reader twice, so cut the sentence or cut the diagram. And a callout used for emphasis rather than for a warning trains the reader to skip callouts, which is expensive the first time one matters.

Name the diagrams you expect to be discussed. The name is the address on the canvas, and an unnamed one opens read only (`SYNTAX.md`).

## Tone

The document is stating findings. That register has a few rules and the rest follows.

**No sentence without a claim in it.** Cut anything that only sets up the next sentence. "It is worth taking a look at how the token is stored" is not a finding, and whatever it was introducing can start the paragraph instead.

**Do not defend absences.** If a design does not include something, say what it does include. A paragraph explaining why the thing is not there puts it back in the reader's head as a live option and invites an argument nobody was having.

**Do not close sections with a maxim.** "Duplication is the price of portability" reads as a conclusion while carrying no information. End on the last fact instead. If the section needs a summary it is too long.

**Emphasis goes on rules and verdicts only.** Bold is where the reader's eye lands first, and their summary of the document gets built from whatever you bolded. Bold a phrase in an aside and that aside becomes the document. Count them before you hand it over.

**Vary the sentence length.** Uniform sentences of similar shape read as generated whatever they say. Short sentences carry findings well.

**Write the same word for the same thing every time.** Synonyms for variety make the reader wonder whether you meant something different. Names of things in the system take the spelling the system uses.

Korean, English, or mixed is the writer's call, and it should match the readers. The rules above hold in any of them.

## Before handing it over

- Every claim has a coordinate, or is explicitly marked as unchecked.
- The first section answers the question on its own.
- Nothing in the evidence sections is a recommendation.
- Every open question names who has to answer it.
- Every diagram earns its place, and the ones that will be discussed have names.
- The bold count is small, and every one of them is on a rule or a verdict.
- The markdown is kept next to the HTML. It is the original, and the next revision starts from it.
