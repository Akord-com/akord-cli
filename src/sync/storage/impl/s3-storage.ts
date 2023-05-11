import { GetObjectCommand, ListObjectsV2Command, ListObjectsV2CommandOutput, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import { Storage, StorageObject } from "../types"
import stream from 'stream';
import path from "path";

export class S3Storage extends Storage {

    public static uriPrefix = "s3://"
    private bucket: string;
    private client: S3Client = new S3Client({})

    constructor(uri: string) {
        super(uri)
        this.bucket = this.uri.replace(S3Storage.uriPrefix, "")
    }

    async list(recursive: boolean = true): Promise<StorageObject[]> {
        let response: ListObjectsV2CommandOutput;
        let nextContinuationToken: string;
        try {
            do {
                response = await this.client.send(new ListObjectsV2Command({
                    Bucket: this.bucket,
                    Delimiter: !recursive ? '/' : '',
                    ContinuationToken: nextContinuationToken,
                }));
                nextContinuationToken = response.NextContinuationToken;
                if (response.Contents !== undefined) {
                    response.Contents.forEach(({ Key, LastModified, Size }) => {
                        if (!Key.endsWith(path.posix.sep)) {
                            this.objects.push({
                                id: Key,
                                key: Key,
                                name: Key,
                                lastModified: LastModified.getTime(),
                                size: Size
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
        const command = new GetObjectCommand({ Bucket: this.bucket, Key: object.id })
        return (await this.client.send(command)).Body as Readable
    }

    public async create(object: StorageObject, readable: Readable, onProgress?: (progress: number) => void): Promise<void> {
        this.put(object, readable, onProgress)
    }

    public async update(object: StorageObject, readable: Readable, onProgress?: (progress: number) => void): Promise<void> {
        this.put(object, readable, onProgress)
    }

    public async delete(object: StorageObject): Promise<void> {
        const command = new GetObjectCommand({ Bucket: this.bucket, Key: object.id })
        await this.client.send(command)
    }

    private async put(object: StorageObject, readable: Readable, onProgress?: (progress: number) => void): Promise<void> {
        const passThroughStream = new stream.PassThrough();
        const parallelUploads3 = new Upload({
            client: this.client,
            params: {
                Bucket: this.bucket,
                Key: object.key,
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
