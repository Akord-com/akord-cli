import { StorageDiff, SyncStorageOptions } from "./storage/types";
import { StorageFactory } from "./storage/factory";

export const sync = async (sourceUri: string, targetUri: string, options: SyncStorageOptions = {}): Promise<StorageDiff> => {
    const sourceStorage = StorageFactory.fromUri(sourceUri)
    const targetStorage = StorageFactory.fromUri(targetUri)

    return await sourceStorage.sync(targetStorage, options)
}
