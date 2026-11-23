You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.


## Git: push every task automatically (standing permission, 2026-11-23)

- When a task that changed files in this git repo is finished and verified, run `git add` (only the files of the task), `git commit` and `git push` yourself. Do not ask for approval and do not wait for the user to type anything: the owner gave a standing permission for all repos.
- Exceptions only: the work is unfinished or failing (do not push a broken state, report what is missing); never commit secrets (passwords, tokens, API keys, `.env`, session files, real configs); no `--force`, no `--no-verify`, no history rewriting, no pushing a different branch than the current one unless asked.
- Commit only files that belong to the current task; leave the user's unrelated uncommitted changes alone.
- If the push is rejected because the remote moved: `git pull --rebase` and push again; on a real conflict stop and report.
