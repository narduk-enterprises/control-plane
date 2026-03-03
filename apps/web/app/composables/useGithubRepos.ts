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
    return useFetch<GithubRepo[]>('/api/github/repos')
}
