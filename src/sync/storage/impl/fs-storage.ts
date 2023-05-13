import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { ListStorageOptions, Storage, StorageObject } from "../types"

export class FsStorage extends Storage {

    public async list(options: ListStorageOptions): Promise<StorageObject[]> {
        this.objects = []
        await this.listFormUri(this.uri, options)
        return this.objects;
    }

    public async get(object: StorageObject): Promise<Readable> {
        return Promise.resolve(fs.createReadStream(path.join(this.uri, object.id)))
    }

    public async create(object: StorageObject, stream: Readable): Promise<void> {
        this.put(object, stream)
    }

    public async update(object: StorageObject, stream: Readable): Promise<void> {
        this.put(object, stream)
    }

    public async delete(object: StorageObject): Promise<void> {
        fs.unlinkSync(object.key)
    }

    public async put(object: StorageObject, stream: Readable): Promise<void> {
        const dirs = object.key.split(path.sep)
        dirs.pop()
        if (dirs.length) {
            await fs.promises.mkdir(this.toLocalPath(path.join(this.uri, dirs.join(path.sep))), { recursive: true });
        }
        stream.pipe(fs.createWriteStream(this.toLocalPath(path.join(this.uri, object.key))))
        await new Promise((resolve, reject) => {
            stream.on('finish', () => {
                resolve(true);
            }).on('error', err => {
                reject(err);
            });
        });
    }

    private async listFormUri(uri: string, options: ListStorageOptions): Promise<void> {
        const localObjects = await fs.promises.readdir(uri)
        if (uri && (!localObjects || !localObjects.length) && options.allowEmptyDirs) {
            this.objects.push({
                lastModified: 0,
                size: 0,
                name: uri,
                id: uri,
                key: uri,
                type: "folder"
            });
        } else {
            for (const childPath of localObjects) {
                const filePath = path.join(uri, childPath);
                const stats = await fs.promises.stat(filePath);
                const id = this.toPosixPath(path.relative(this.uri, filePath));
                if (path.basename(childPath).startsWith('.') && !options.includeHidden) {
                    this.excludedObjects.push({
                        lastModified: stats.mtimeMs,
                        size: stats.size,
                        name: id,
                        id: id,
                        key: id,
                        type: stats.isDirectory() ? "folder" : "file"
                    })
                } else {
                    if (stats.isDirectory() && options.recursive) {
                        await this.listFormUri(filePath, options);
                    } else {
                        this.objects.push({
                            lastModified: stats.mtimeMs,
                            size: stats.size,
                            name: id,
                            id: id,
                            key: id,
                            type: "file"
                        });
                    }
                }
            }
        }
    }

    private toPosixPath(filePath: string) {
        return filePath.split(path.sep).join(path.posix.sep);
    }

    private toLocalPath(filePath: string) {
        return filePath.split(path.posix.sep).join(path.sep);
    }
}
