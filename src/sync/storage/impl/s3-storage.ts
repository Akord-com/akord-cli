import { GetObjectCommand, ListObjectsV2Command, ListObjectsV2CommandInput, ListObjectsV2CommandOutput, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import { ListStorageOptions, Storage, StorageObject } from "../types"
import stream from 'stream';
import path from "path";

export class S3Storage extends Storage {

    public static uriPrefix = "s3://"
    private bucket: string;
    private prefix: string;
    private client: S3Client = new S3Client({});

    constructor(uri: string) {
        super(uri);
        const path = this.uri.replace(S3Storage.uriPrefix, "").split("/");
        this.bucket = path.shift();
        this.prefix = path.length ? path.join('/') : null;
        if (this.prefix && !this.prefix.endsWith('/')) {
            this.prefix += '/';
        }
    }

    async list(options: ListStorageOptions): Promise<StorageObject[]> {
        let response: ListObjectsV2CommandOutput
        let request: ListObjectsV2CommandInput = {
            Bucket: this.bucket,
            Prefix: this.prefix ? this.prefix : '',
            Delimiter: options.recursive ? '' : '/'
        }
        let nextContinuationToken: string;
        try {
            do {
                if (nextContinuationToken) {
                    request.ContinuationToken = nextContinuationToken;
                }
                response = await this.client.send(new ListObjectsV2Command(request));
                nextContinuationToken = response.NextContinuationToken;
                if (response.Contents !== undefined) {
                    response.Contents.forEach(({ Key, LastModified, Size }) => {
                        if (!Key.endsWith(path.posix.sep)) {
                            const key = this.prefix ? Key.replace(this.prefix, '') : Key
                            if (!options.includeHidden && key.split('/').some(object => object.startsWith('.'))) {
                                this.excludedObjects.push({
                                    id: key,
                                    key: key,
                                    name: key,
                                    lastModified: LastModified.getTime(),
                                    size: Size
                                });
                            } else {
                                this.objects.push({
                                    id: key,
                                    key: key,
                                    name: key,
                                    lastModified: LastModified.getTime(),
                                    size: Size
                                });
                            }
                        }
                    });
                }
                if (response.CommonPrefixes !== undefined) {
                    response.CommonPrefixes.forEach(({ Prefix }) => {
                        const key = (this.prefix ? Prefix.replace(this.prefix, '') : Prefix).replace('/', '')
                        if (!options.includeHidden && key.split('/').some(object => object.startsWith('.'))) {
                            this.excludedObjects.push({
                                id: key,
                                key: key,
                                name: key,
                                lastModified: 0,
                                size: 0,
                                type: "folder"
                            });
                        } else {
                            this.objects.push({
                                id: key,
                                key: key,
                                name: key,
                                lastModified: 0,
                                size: 0,
                                type: "folder"
                            });
                        }
                    });
                }
            } while (response.IsTruncated);
        } catch (e) {
            throw Error('Incorrect bucket URI or no access to specified bucket')
        }
        return this.objects
    }

    public async get(object: StorageObject): Promise<Readable> {
        const command = new GetObjectCommand({ Bucket: this.bucket, Key: this.prefix ? this.prefix + object.key : object.key })
        return (await this.client.send(command)).Body as Readable
    }

    public async create(object: StorageObject, readable: Readable, onProgress?: (progress: number) => void): Promise<void> {
        this.put(object, readable, onProgress)
    }

    public async update(object: StorageObject, readable: Readable, onProgress?: (progress: number) => void): Promise<void> {
        this.put(object, readable, onProgress)
    }

    public async delete(object: StorageObject): Promise<void> {
        const command = new GetObjectCommand({ Bucket: this.bucket, Key: this.prefix ? this.prefix + object.key : object.key })
        await this.client.send(command)
    }

    private async put(object: StorageObject, readable: Readable, onProgress?: (progress: number) => void): Promise<void> {
        const passThroughStream = new stream.PassThrough();
        const parallelUploads3 = new Upload({
            client: this.client,
            params: {
                Bucket: this.bucket,
                Key: this.prefix ? this.prefix + object.key : object.key,
                Body: passThroughStream
            },
        });
        readable.pipe(passThroughStream);

        parallelUploads3.on("httpUploadProgress", (progress) => {
            if (onProgress) {
                onProgress(Math.floor(progress.loaded / progress.total) / 100)
            }
        });
        await parallelUploads3.done();
    }
}
