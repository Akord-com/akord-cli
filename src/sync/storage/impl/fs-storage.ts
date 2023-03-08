import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { Storage, StorageObject } from "../types"

export class FsStorage extends Storage {
    
    public async list(recursive: boolean = true): Promise<StorageObject[]> {
        const objects: StorageObject[] = []
        await this.listFormUri(this.uri, objects, recursive)
        return objects;
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

    private async listFormUri(uri: string, objects: StorageObject[] = [], recursive?: boolean): Promise<void> {
        const localObjects = await fs.promises.readdir(uri)
        for (const childPath of localObjects) {
            const filePath = path.join(uri, childPath);
            const stats = await fs.promises.stat(filePath);
            if (stats.isDirectory() && recursive) {
                await this.listFormUri(filePath, objects, recursive);
            } else {
                const id = this.toPosixPath(path.relative(this.uri, filePath));
                objects.push({
                    lastModified: stats.mtimeMs,
                    size: stats.size,
                    name: id,
                    id: id,
                    key: id
                });
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
