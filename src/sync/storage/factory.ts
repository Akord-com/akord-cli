import { Storage } from "./types";
import { FsStorage } from "./impl/fs-storage";
import { S3Storage } from "./impl/s3-storage";
import { AkordStorage } from "./impl/akord-storage";

export class StorageFactory { 
    static fromUri(uri: string): Storage {
        if (uri.startsWith(AkordStorage.uriPrefix)) {
            return new AkordStorage(uri)
        } else if (uri.startsWith(S3Storage.uriPrefix)) {
            return new S3Storage(uri)
        } else {
            return new FsStorage(uri)
        }
    }
}
