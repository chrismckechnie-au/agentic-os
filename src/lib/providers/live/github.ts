import "server-only";

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Repo } from "@/lib/types";
import { readThroughCache } from "@/lib/server/cache";
import { readLiveSessionSnapshot } from "@/lib/providers/live/session-snapshot";

const CACHE_TTL_MS = 60_000;

function git(args: string[], cwd: string): string | null {
  try {
    return execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3_000,
      encoding: "utf-8",
    }).trim();
  } catch {
    return null;
  }
}

function relativeTime(value: string): string | undefined {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return undefined;

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function parseGithubRemote(remote: string): { owner: string; name: string } | null {
  const ssh = remote.match(/^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/i);
  if (ssh) return { owner: ssh[1], name: ssh[2] };

  try {
    const url = new URL(remote);
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.replace(/^\/|\.git$/g, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], name: parts[1] };
  } catch {
    return null;
  }
}

function guessLanguage(repoRoot: string): { language?: string; color?: string } {
  const checks: Array<{ files: string[]; language: string; color: string }> = [
    { files: ["tsconfig.json"], language: "TypeScript", color: "#3178c6" },
    { files: ["package.json"], language: "JavaScript", color: "#f1e05a" },
    { files: ["pyproject.toml", "requirements.txt"], language: "Python", color: "#3572a5" },
    { files: ["go.mod"], language: "Go", color: "#00add8" },
    { files: ["Cargo.toml"], language: "Rust", color: "#dea584" },
    { files: ["Gemfile"], language: "Ruby", color: "#701516" },
  ];

  for (const check of checks) {
    if (check.files.some((file) => fs.existsSync(path.join(repoRoot, file)))) {
      return { language: check.language, color: check.color };
    }
  }

  return {};
}

function collectRepoRoots(): Map<string, Set<string>> {
  const snapshot = readLiveSessionSnapshot();
  const sessions = [...snapshot.claude, ...snapshot.codex];
  const repoAgents = new Map<string, Set<string>>();

  for (const session of sessions) {
    if (!session.cwd) continue;
    const repoRoot = git(["rev-parse", "--show-toplevel"], session.cwd);
    if (!repoRoot) continue;
    if (!repoAgents.has(repoRoot)) repoAgents.set(repoRoot, new Set<string>());
    repoAgents.get(repoRoot)?.add(session.agentId);
  }

  return repoAgents;
}

async function fetchGithubMetadata(
  owner: string,
  name: string,
): Promise<{ repo: Partial<Repo>; status: Repo["metadataStatus"] } | null> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.GITHUB_PAT;
  const headers: HeadersInit = {
    accept: "application/vnd.github+json",
    "user-agent": "agentic-os",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers,
      cache: "no-store",
    });
    if (!repoRes.ok) {
      return {
        repo: {},
        status: token ? "unavailable" : "unauthenticated",
      };
    }
    const repo = (await repoRes.json()) as Record<string, unknown>;

    let openPRs: number | undefined;
    const pullsRes = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls?state=open&per_page=1`, {
      headers,
      cache: "no-store",
    });
    if (pullsRes.ok) {
      const link = pullsRes.headers.get("link");
      const lastPage = link?.match(/&page=(\d+)>; rel="last"/)?.[1];
      if (lastPage) openPRs = Number(lastPage);
      else {
        const pulls = (await pullsRes.json()) as unknown[];
        openPRs = pulls.length;
      }
    }

    return {
      status: "available",
      repo: {
        owner,
        name,
        description: typeof repo.description === "string" ? repo.description : undefined,
        language: typeof repo.language === "string" ? repo.language : undefined,
        stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : undefined,
        forks: typeof repo.forks_count === "number" ? repo.forks_count : undefined,
        openIssues: typeof repo.open_issues_count === "number" ? repo.open_issues_count : undefined,
        openPRs,
        defaultBranch: typeof repo.default_branch === "string" ? repo.default_branch : undefined,
        private: typeof repo.private === "boolean" ? repo.private : undefined,
        visibility:
          typeof repo.private === "boolean"
            ? repo.private ? "private" : "public"
            : undefined,
      },
    };
  } catch {
    return {
      repo: {},
      status: "unavailable",
    };
  }
}

async function loadRepos(): Promise<Repo[]> {
  const repoAgents = collectRepoRoots();
  const repos = await Promise.all(
    [...repoAgents.entries()].map(async ([repoRoot, agents]): Promise<Repo> => {
      const remote = git(["remote", "get-url", "origin"], repoRoot) ?? undefined;
      const remoteRepo = remote ? parseGithubRemote(remote) : null;
      const guessedLanguage = guessLanguage(repoRoot);
      const defaultBranch =
        git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], repoRoot)?.replace(/^origin\//, "") ??
        git(["branch", "--show-current"], repoRoot) ??
        undefined;
      const lastCommit = git(["log", "-1", "--format=%cI"], repoRoot);

      const baseRepo: Repo = {
        id: repoRoot,
        name: remoteRepo?.name ?? path.basename(repoRoot),
        owner: remoteRepo?.owner ?? "local",
        description: remote ?? repoRoot,
        language: guessedLanguage.language,
        languageColor: guessedLanguage.color,
        pushedAt: lastCommit ? relativeTime(lastCommit) : undefined,
        defaultBranch,
        visibility: "unknown",
        metadataSource: "local",
        metadataStatus: remoteRepo ? "unavailable" : "not_github",
        agents: agents.size,
      };

      if (!remoteRepo) return baseRepo;

      const githubRepo = await fetchGithubMetadata(remoteRepo.owner, remoteRepo.name);
      if (!githubRepo || githubRepo.status !== "available") {
        return {
          ...baseRepo,
          metadataStatus: githubRepo?.status ?? "unavailable",
        };
      }

      return {
        ...baseRepo,
        ...githubRepo.repo,
        id: `${remoteRepo.owner}/${remoteRepo.name}`,
        metadataSource: "github",
        metadataStatus: "available",
      };
    }),
  );

  repos.sort((left, right) => {
    const rightAgents = right.agents ?? 0;
    const leftAgents = left.agents ?? 0;
    if (rightAgents !== leftAgents) return rightAgents - leftAgents;
    return left.name.localeCompare(right.name);
  });

  return repos;
}

export async function listRepos(): Promise<Repo[]> {
  return readThroughCache("repos:live-list", CACHE_TTL_MS, () => loadRepos());
}

export async function getRepo(owner: string, name: string): Promise<Repo | null> {
  const repos = await listRepos();
  return repos.find((repo) => repo.owner === owner && repo.name === name) ?? null;
}
