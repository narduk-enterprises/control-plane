export interface GithubRepo {
    id: number
    name: string
    fullName: string
    description: string | null
    url: string
    private: boolean
    updatedAt: string
    language: string | null
    latestRun: {
        status: string
        conclusion: string | null
        url: string
        name: string
        createdAt: string
    } | null
}

interface GithubRawRepo {
    id: number
    name: string
    full_name: string
    description: string | null
    html_url: string
    private: boolean
    updated_at: string
    language: string | null
}

interface GithubRawRuns {
    workflow_runs: Array<{
        status: string
        conclusion: string | null
        html_url: string
        name: string
        created_at: string
    }>
}

export default defineEventHandler(async (_event): Promise<GithubRepo[]> => {
    const config = useRuntimeConfig()
    const token = config.githubToken

    if (!token) {
        throw createError({
            statusCode: 401,
            statusMessage: 'GitHub token is missing in configuration.',
        })
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Narduk-Control-Plane',
    }

    try {
        // Fetch 10 most recently updated repositories for the authenticated user
        const reposRes = await $fetch<GithubRawRepo[]>('https://api.github.com/user/repos?sort=updated&per_page=12', {
            headers,
        })
        const repos = reposRes

        // For each repo, fetch the latest workflow run
        const reposWithActions = await Promise.all(
            // eslint-disable-next-line nuxt-guardrails/no-map-async-in-server
            repos.map(async (repo: GithubRawRepo) => {
                let latestRun: GithubRepo['latestRun'] = null
                try {
                    const runsRes = await $fetch<GithubRawRuns>(`https://api.github.com/repos/${repo.full_name}/actions/runs?per_page=1`, {
                        headers,
                    })
                    const runsResponse = runsRes
                    if (runsResponse && runsResponse.workflow_runs && runsResponse.workflow_runs.length > 0) {
                        const run = runsResponse.workflow_runs[0]
                        if (run) {
                            latestRun = {
                                status: run.status,
                                conclusion: run.conclusion,
                                url: run.html_url,
                                name: run.name,
                                createdAt: run.created_at,
                            }
                        }
                    }
                } catch (e) {
                    // If actions are disabled or not found, it might 404/403. We just ignore it.
                    console.warn(`Could not fetch actions for ${repo.full_name}:`, e)
                }

                return {
                    id: repo.id,
                    name: repo.name,
                    fullName: repo.full_name,
                    description: repo.description,
                    url: repo.html_url,
                    private: repo.private,
                    updatedAt: repo.updated_at,
                    language: repo.language,
                    latestRun,
                }
            })
        )

        return reposWithActions
    } catch (error: unknown) {
        console.error('Failed to fetch from GitHub API:', error)
        const status = (error as { response?: { status?: number } })?.response?.status || 500
        throw createError({
            statusCode: status,
            statusMessage: 'Failed to fetch GitHub data',
        })
    }
})
