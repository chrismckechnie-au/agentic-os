import "server-only";

import type { Repo } from "@/lib/types";

// Live GitHub source for the Repos section.
//
// TODO(live): implement with the GitHub REST API.
//   - Auth via process.env.GITHUB_TOKEN
//   - GET /user/repos?per_page=100&sort=pushed   -> map to Repo[]
//   - GET /repos/{owner}/{repo}/pulls?state=open  -> openPRs count
//   - Map: full_name, description, language, stargazers_count, forks_count,
//          open_issues_count, pushed_at (humanize), default_branch, private.
//
// Keep all fetches server-side. Cache with `next: { revalidate: 300 }`.

export async function listRepos(): Promise<Repo[]> {
  throw new Error("github.listRepos not implemented (see TODO).");
}

export async function getRepo(): Promise<Repo | null> {
  throw new Error("github.getRepo not implemented (see TODO).");
}
