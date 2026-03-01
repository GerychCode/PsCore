export interface ITag {
    id: number
    name: string
    severity: number
    description: string | null
}

export interface ITagCreate {
    name: string
    severity?: number
    description?: string
}

export interface ITagUpdate {
    name?: string
    severity?: number
    description?: string
}