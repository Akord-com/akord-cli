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

    public async list(recursive: boolean = true, allowEmptyDirs: boolean = false, excludeHidden: boolean = false): Promise<StorageObject[]> {
        this.objects = []
        await this.initGuard()
        await this.listFormUri("null", "", recursive, allowEmptyDirs, excludeHidden)
        return this.objects
    }

    public async get(object: StorageObject): Promise<Readable> {
        await this.initGuard()
        const arrayBuffer = await this.akord.file.get(object.uri, this.vaultId)
        const buffer = Buffer.from(new Uint8Array(arrayBuffer))
        return Readable.from(buffer)
    }

    public async create(object: StorageObject, stream?: Readable): Promise<void> {
        await this.initGuard()
        const { key, parentId } = await this.putDirs(object.key)
        if (object.type === "folder") {
            await this.akord.folder.create(this.vaultId, key, parentId)
        } else {
            const file = await NodeJs.File.fromReadable(stream, key, object.mimeType)
            await this.akord.stack.create(this.vaultId, file, key, parentId)
        }
    }

    public async update(object: StorageObject, stream: Readable): Promise<void> {
        await this.initGuard()
        const file = await NodeJs.File.fromReadable(stream, object.key, object.mimeType)
        const stack = this.objects.find(o => o.key === object.key)
        await this.akord.stack.uploadRevision(stack.id, file)
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

    private async putDirs(uri: string): Promise<{ key: string, parentId: string }> {
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

    private async listFormUri(uri: string, path: string, recursive?: boolean, allowEmptyDirs?: boolean, excludeHidden?: boolean): Promise<void> {
        const [folders, stacks] = await Promise.all([await this.akord.folder.listAll(this.vaultId, uri), await this.akord.stack.listAll(this.vaultId, uri)])

        if (uri && !folders.length && !stacks.length && allowEmptyDirs) {
            const folder = await this.akord.folder.get(uri)
            const folderPath = path ? `${path}/${folder.name}` : folder.name
            this.objects.push({
                lastModified: 0,
                size: 0,
                name: folder.name,
                id: folder.id,
                key: folderPath,
                type: "folder"
            });
        }

        for (const stack of stacks) {
            const version = stack.versions[stack.versions.length - 1]
            const stackPath = path ? `${path}/${stack.name}` : stack.name
            const resourceUri = this.getResourceUri(version.resourceUri, "s3")
            if (excludeHidden && stack.name.startsWith('.')) {
                this.excludedObjects.push({
                    lastModified: 0,
                    size: 0,
                    name: stack.name,
                    id: stack.id,
                    key: stackPath,
                    type: "file"
                });
            } else {
                this.objects.push({
                    lastModified: 0,
                    size: version.size,
                    name: version.name,
                    id: stack.id,
                    uri: resourceUri,
                    key: stackPath,
                    type: "file"
                });
            }
        }

        for (const folder of folders) {
            const folderPath = path ? `${path}/${folder.name}` : folder.name
            if (excludeHidden && folder.name.startsWith('.')) {
                this.excludedObjects.push({
                    lastModified: 0,
                    size: 0,
                    name: folder.name,
                    id: folder.id,
                    key: folderPath,
                    type: "folder"
                });
            } else {
                this.dirTrie.set(folderPath, folder.id)
                if (recursive) {
                    await this.listFormUri(folder.id, folderPath, recursive)
                }
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
