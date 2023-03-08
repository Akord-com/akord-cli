import { Readable } from "stream";

export abstract class Storage {
    protected uri: string;
    protected objects: StorageObject[] = [];

    constructor(uri: string) {
        this.uri = uri
    }

    public abstract list(recursive?: boolean): Promise<StorageObject[]>
    public abstract get(object: StorageObject): Promise<Readable>
    public abstract create(object: StorageObject, stream: Readable): Promise<void>
    public abstract update(object: StorageObject, stream: Readable): Promise<void>
    public abstract delete(object: StorageObject): Promise<void>

    public async sync(storage: Storage, options: SyncStorageOptions = {}): Promise<StorageDiff> {
        const diff = await this.diff(storage)
        if (options.dryRun) {
            return diff
        }
        if (options.onApprove && !(await options.onApprove(diff))) {
            return
        }
        for (const object of diff.created) {
            options.onProgress(`Creating... ${object.key}`)
            try {
                await storage.create(object, (await this.get(object)))
            } catch (e) {
                options.onProgress(`Failed creating: ${object.key}`, true)
            }
        }
        for (const object of diff.updated) {
            options.onProgress(`Updating... ${object.key}`)
            try {
                await storage.update(object, (await this.get(object)))
            } catch (e) {
                options.onProgress(`Failed updating: ${object.key}`, true)
            }
        }
        if (options.delete) {
            await Promise.all(diff.deleted.map(async object => {
                options.onProgress(`Deleting... ${object.key}`)
                try {
                    await storage.delete(object)
                } catch (e) {
                    options.onProgress(`Failed deleting: ${object.key}`, true)
                }
                return true
            }))
        }
        if (options.onDone) {
            options.onDone()
        }
    }

    public async diff(storage: Storage): Promise<StorageDiff> {
        const sourceStorageContents = await this.list()
        const targetStorageContents = await storage.list()

        const sourceObjectMap = new Map(
            sourceStorageContents.map((sourceObject) => [sourceObject.key, sourceObject]),
        );
        const targetObjectMap = new Map(
            targetStorageContents.map((targetObject) => [targetObject.key, targetObject]),
        );
        let totalStorage = 0;
        const created = [];
        const updated = [];
        sourceObjectMap.forEach((sourceObject) => {
            const targetObject = targetObjectMap.get(sourceObject.key);
            if (targetObject === undefined) {
                created.push(sourceObject);
                totalStorage += sourceObject.size
            } else if (sourceObject.size !== targetObject.size) {
                updated.push(sourceObject);
                totalStorage += sourceObject.size
            }
        });

        const deleted = [];
        targetObjectMap.forEach((targetObject) => {
            if (!sourceObjectMap.has(targetObject.key)) {
                deleted.push(targetObject);
            }
        });
        return { created, updated, deleted, totalStorage };
    }
}

export type StorageObject = {
    id: string,
    key: string,
    name: string,
    lastModified: number,
    size: number,
    mimeType?: string,
    parentId?: string,
}

export type StorageDiff = {
    created: StorageObject[],
    updated: StorageObject[],
    deleted: StorageObject[],
    totalStorage: number,
}

export type SyncStorageOptions = {
    dryRun?: boolean,
    autoApprove?: boolean,
    delete?: boolean,
    recursive?: boolean,
    excludeHidden?: boolean,
    onApprove?: (diff: StorageDiff) => Promise<boolean>
    onProgress?: (progress: string, error?: boolean) => void
    onDone?: () => void
}
