import test from "node:test";
import assert from "node:assert/strict";
import {
  extractTaskCounts,
  extractWikiLinks,
  parseFrontmatter,
  prepareNotes,
  stripFrontmatter,
} from "./parse.ts";
import type { Note } from "../types";

test("parses frontmatter tags, title, and updated date", () => {
  const parsed = parseFrontmatter(`---
title: "Launch Plan"
tags:
  - refuelr
  - roadmap
updated: 2026-06-01
---
# Launch Plan`);

  assert.equal(parsed.title, "Launch Plan");
  assert.deepEqual(parsed.tags, ["refuelr", "roadmap"]);
  assert.equal(parsed.updated, "2026-06-01");
});

test("strips frontmatter and extracts wiki links", () => {
  const source = `---
tags: [alpha]
---
# Note
See [[Project Overview|overview]], [[Research/RAG architectures#Qdrant]], and [[Missing Memo]].`;

  assert.equal(stripFrontmatter(source).startsWith("# Note"), true);
  assert.deepEqual(
    extractWikiLinks(source).map((link) => ({ target: link.target, label: link.label })),
    [
      { target: "Project Overview", label: "overview" },
      { target: "Research/RAG architectures", label: "Research/RAG architectures#Qdrant" },
      { target: "Missing Memo", label: "Missing Memo" },
    ],
  );
});

test("counts checked and unchecked markdown tasks", () => {
  assert.deepEqual(
    extractTaskCounts(`- [x] Done
- [ ] Open
* [X] Also done`),
    { total: 3, completed: 2, open: 1 },
  );
});

test("resolves outlinks and backlinks across notes", () => {
  const notes: Note[] = [
    {
      id: "Projects/Project Overview.md",
      title: "Project Overview",
      updatedAt: "2026-06-01T00:00:00.000Z",
      body: "# Project Overview\nSee [[Research/RAG architectures]] and [[Missing Memo]].",
    },
    {
      id: "Research/RAG architectures.md",
      title: "RAG architectures",
      updatedAt: "2026-06-01T00:00:00.000Z",
      body: "# RAG architectures\nBack to [[Project Overview]].",
    },
  ];

  const prepared = prepareNotes(notes, "Refuelr");
  const project = prepared[0];
  const research = prepared[1];

  assert.equal(project.outlinks?.[0].resolvedId, research.id);
  assert.equal(project.outlinks?.[1].resolvedId, undefined);
  assert.equal(project.backlinks?.[0].id, research.id);
  assert.equal(research.backlinks?.[0].id, project.id);
});
