export interface GithubRepo {
    id: number
    name: string
    fullName: string
    description: string | null
    url: string
    private: boolean
    updatedAt: string
    language: string | null
    stars: number
    forks: number
    openIssues: number
    latestRun: {
        status: string
        conclusion: string | null
        url: string
        name: string
        createdAt: string
    } | null
}

export function useGithubRepos() {
    const forceQuery = ref(false)

    const { data, status, error, refresh } = useFetch<GithubRepo[]>('/api/github/repos', {
        query: computed(() => ({
            force: forceQuery.value ? 'true' : undefined,
        })),
        default: () => [],
    })

    async function forceRefresh() {
        forceQuery.value = true
        await refresh()
        forceQuery.value = false
    }

    return { data, status, error, refresh, forceRefresh }
}
