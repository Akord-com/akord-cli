import { Akord } from "@akord/akord-js";
import { NodeJs } from "@akord/akord-js/lib/types/file";
import path from "path";
import { Readable } from "stream";
import { loadCredentials } from "../../../handlers";
import { Storage, StorageObject } from "../types"

export class AkordStorage extends Storage {
    
    public static uriPrefix = "akord://"
    private vaultId: string
    private akord: Akord
    private dirTrie: Map<string, string> = new Map()

    constructor(uri: string) {
        super(uri);
        this.vaultId = this.uri.replace(AkordStorage.uriPrefix, "")
    }

    async list(recursive: boolean = true): Promise<StorageObject[]> {
        await this.initGuard()
        const objects: StorageObject[] = []
        await this.listFormUri("null", objects, "", recursive)
        return objects
    }

    public async get(object: StorageObject): Promise<Readable> {
        await this.initGuard()
        const arrayBuffer = await this.akord.file.get(object.id, this.vaultId)
        const buffer = Buffer.from(new Uint8Array(arrayBuffer))
        return Readable.from(buffer)
    }

    public async create(object: StorageObject, stream: Readable, onProgress?: (progress: number) => void): Promise<void> {
        await this.initGuard()
        const { key, parentId } = await this.putDirs(object.key)
        const file = await NodeJs.File.fromReadable(stream, key, object.mimeType)
        await this.akord.stack.create(this.vaultId, file, key, object.parentId || parentId, (progress, _data) => onProgress(progress))
    }

    public async update(object: StorageObject, stream: Readable, onProgress?: (progress: number) => void): Promise<void> {
        await this.initGuard()
        const file = await NodeJs.File.fromReadable(stream, object.key, object.mimeType)
        await this.akord.stack.uploadRevision(object.id, file, onProgress)
    }

    public async delete(object: StorageObject): Promise<void> {
        await this.akord.stack.revoke(object.id, this.vaultId)
    }

    private async initGuard() {
        if (!this.akord) {
            const { wallet, jwtToken } = await loadCredentials();
            this.akord = await Akord.init(wallet, jwtToken)
        }
    }
    private async putDirs(uri: string): Promise<{key: string, parentId: string}> {
        const dirs = uri.split(path.posix.sep)
        const key = dirs.pop()
        let parentId = null
        let dirPath = ''
        for (const dir of dirs) {
            dirPath += dir
            if (this.dirTrie.has(dirPath)) {
                parentId = this.dirTrie.get(dirPath)
            } else {
                const { folderId } = await this.akord.folder.create(this.vaultId, dir, parentId)
                this.dirTrie.set(dirPath, folderId)
                parentId = folderId
            }
            dirPath += path.posix.sep
        }
        return { key, parentId }
    }

    private async listFormUri(uri: string, objects: StorageObject[] = [], path: string, recursive?: boolean): Promise<void> {
        const [folders, stacks] = await Promise.all([await this.akord.folder.listAll(this.vaultId, uri), await this.akord.stack.listAll(this.vaultId, uri)])

        for (const stack of stacks) {
            const version = stack.versions[stack.versions.length - 1]
            const stackPath = path ? `${path}/${stack.name}` : stack.name
            const resourceUri = this.getResourceUri(version.resourceUri, "s3")
            objects.push({
                lastModified: 0,
                size: version.size,
                name: version.name,
                id: resourceUri,
                key: stackPath,
                parentId: uri
            });
        }

        for (const folder of folders) {
            const folderPath = path ? `${path}/${folder.name}` : folder.name
            this.dirTrie.set(folderPath, folder.id)
            if (recursive) {
                await this.listFormUri(folder.id, objects, folderPath, recursive)
            }
        }
    }

    private getResourceUri(uris: Array<string>, resourceType: string) {
        const uri = uris.find(uri => uri.startsWith(`${resourceType}:`));
        if (uri) {
          return uri.replace(`${resourceType}:`, "");
        }
        return null;
      };
}
