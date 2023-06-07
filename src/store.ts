import * as fs from 'fs'

class FileStorage implements Storage {
    [name: string]: any;
    length: number;
    path: string

    constructor(path: string) {
        this.path = path
    }

    clear(): void {
        if (fs.existsSync(this.path)) {
            fs.unlinkSync(this.path)
        }
    }
    getItem(key: string): string {
        if (!fs.existsSync(this.path)) {
            return null
        }
        const file = fs.readFileSync(this.path, {
            encoding: 'utf-8'
        })
        const store = JSON.parse(file)
        return store[key]
    }

    key(index: number): string {
        if (fs.existsSync(this.path)) {
            const file = fs.readFileSync(this.path, {
                encoding: 'utf-8'
            })
            const store = JSON.parse(file)
            return Object.keys(store)[index]
        }
        return null
    }

    removeItem(key: string): void {
        if (fs.existsSync(this.path)) {
            const file = fs.readFileSync(this.path, {
                encoding: 'utf-8'
            })
            const store = JSON.parse(file)
            if (store[key]) {
                delete store[key]
            }
            fs.writeFileSync(this.path, JSON.stringify(store))
        }
    }
    setItem(key: string, value: string): void {
        let store: object
        if (!fs.existsSync(this.path)) {
            store = {}
        } else {
            const file = fs.readFileSync(this.path, {
                encoding: 'utf-8'
            })
            store = JSON.parse(file)
        }
        store[key] = value
        fs.writeFileSync(this.path, JSON.stringify(store))
    }
}

export { FileStorage }
